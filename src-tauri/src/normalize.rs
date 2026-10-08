use rusqlite::{functions::FunctionFlags, Connection};
use std::cmp::Ordering;

/// Arabic-Indic (٠-٩) and Persian (۰-۹) digits as ASCII digits; everything else unchanged.
pub fn ascii_digits(value: &str) -> String {
    value
        .chars()
        .map(|c| match c {
            '٠'..='٩' => char::from(b'0' + (c as u32 - '٠' as u32) as u8),
            '۰'..='۹' => char::from(b'0' + (c as u32 - '۰' as u32) as u8),
            other => other,
        })
        .collect()
}

/// The digits of a phone number, whichever digits it was typed with.
pub fn normalize_phone(value: &str) -> String {
    ascii_digits(value)
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect()
}

/// Folds the spelling differences people do not notice when they type Arabic: hamza
/// forms of alef, alef maqsura, teh marbuta, diacritics and tatweel, digit scripts,
/// letter case and repeated spaces. «أحمد» and «احمد», «مصطفى» and «مصطفي», «فاطمة»
/// and «فاطمه» all compare equal.
pub fn normalize_text(value: &str) -> String {
    ascii_digits(value)
        .chars()
        .filter_map(|c| match c {
            '\u{064B}'..='\u{065F}' | '\u{0670}' | '\u{0640}' => None,
            'أ' | 'إ' | 'آ' | 'ٱ' => Some('ا'),
            'ى' => Some('ي'),
            'ة' => Some('ه'),
            other => Some(other),
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// A `LIKE … ESCAPE '\'` pattern that matches `value` anywhere, with `%` and `_` typed by
/// the lawyer taken literally.
pub fn like_pattern(value: &str) -> String {
    let mut pattern = String::with_capacity(value.len() + 2);
    pattern.push('%');
    for c in value.chars() {
        if matches!(c, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(c);
    }
    pattern.push('%');
    pattern
}

/// Orders file numbers the way people read them: «2026/9» before «2026/15» before
/// «2026/100», and «9» before «10».
pub fn natural_cmp(left: &str, right: &str) -> Ordering {
    let (left, right) = (normalize_text(left), normalize_text(right));
    let mut a = left.chars().peekable();
    let mut b = right.chars().peekable();
    loop {
        match (a.peek().copied(), b.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let take = |chars: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut digits = String::new();
                    while let Some(c) = chars.peek().copied().filter(char::is_ascii_digit) {
                        digits.push(c);
                        chars.next();
                    }
                    digits
                };
                let (x, y) = (take(&mut a), take(&mut b));
                let (x, y) = (x.trim_start_matches('0'), y.trim_start_matches('0'));
                let order = x.len().cmp(&y.len()).then_with(|| x.cmp(y));
                if order != Ordering::Equal {
                    return order;
                }
            }
            (Some(x), Some(y)) => {
                if x != y {
                    return x.cmp(&y);
                }
                a.next();
                b.next();
            }
        }
    }
}

/// SQL helpers available on every vault connection: `lm_normalize(text)` applies
/// [`normalize_text`] and `lm_digits(text)` applies [`normalize_phone`].
pub fn register_sql_functions(conn: &Connection) -> rusqlite::Result<()> {
    let flags = FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC;
    conn.create_scalar_function("lm_normalize", 1, flags, |context| {
        Ok(context
            .get::<Option<String>>(0)?
            .map(|value| normalize_text(&value))
            .unwrap_or_default())
    })?;
    conn.create_scalar_function("lm_digits", 1, flags, |context| {
        Ok(context
            .get::<Option<String>>(0)?
            .map(|value| normalize_phone(&value))
            .unwrap_or_default())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn everyday_arabic_spelling_variants_compare_equal() {
        assert_eq!(normalize_text("أحمد"), normalize_text("احمد"));
        assert_eq!(normalize_text("إبراهيم"), normalize_text("ابراهيم"));
        assert_eq!(normalize_text("مصطفى"), normalize_text("مصطفي"));
        assert_eq!(normalize_text("فاطمة"), normalize_text("فاطمه"));
        assert_eq!(normalize_text("مُحَمَّد"), normalize_text("محمد"));
        assert_eq!(normalize_text("محـــمد"), normalize_text("محمد"));
        assert_eq!(normalize_text("قضية ٤٤٧"), normalize_text("قضيه 447"));
        assert_eq!(normalize_text("  Ahmed   ALI "), "ahmed ali");
    }

    #[test]
    fn different_names_stay_different() {
        assert_ne!(normalize_text("أحمد"), normalize_text("حمد"));
        assert_ne!(normalize_text("علي"), normalize_text("عل"));
    }

    #[test]
    fn phone_digits_ignore_spaces_dashes_and_digit_script() {
        assert_eq!(normalize_phone("0122 333 4444"), "01223334444");
        assert_eq!(normalize_phone("٠١٢٢-٣٣٣-٤٤٤٤"), "01223334444");
        assert_eq!(normalize_phone("+20 (10) 1234"), "20101234");
        assert_eq!(normalize_phone("لا يوجد"), "");
    }

    #[test]
    fn like_patterns_take_wildcards_literally() {
        assert_eq!(like_pattern("أحمد"), "%أحمد%");
        assert_eq!(like_pattern("50%_a\\b"), "%50\\%\\_a\\\\b%");
    }

    #[test]
    fn file_numbers_sort_by_their_numbers() {
        let mut numbers = vec![
            "2026/100",
            "10",
            "2026/15",
            "9",
            "2026/9",
            "٢٠٢٦/٢",
            "P-1",
            "P-10",
            "P-2",
        ];
        numbers.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(
            numbers,
            vec![
                "9",
                "10",
                "٢٠٢٦/٢",
                "2026/9",
                "2026/15",
                "2026/100",
                "P-1",
                "P-2",
                "P-10"
            ]
        );
        assert_eq!(natural_cmp("007", "7"), Ordering::Equal);
    }

    #[test]
    fn sql_functions_normalize_inside_queries() {
        let conn = Connection::open_in_memory().unwrap();
        register_sql_functions(&conn).unwrap();
        let matched: bool = conn
            .query_row(
                "SELECT lm_normalize('أحمد محمود') LIKE ?1 ESCAPE '\\'",
                [like_pattern(&normalize_text("احمد"))],
                |row| row.get(0),
            )
            .unwrap();
        assert!(matched);
        let digits: String = conn
            .query_row("SELECT lm_digits('٠١٠ 0123')", [], |row| row.get(0))
            .unwrap();
        assert_eq!(digits, "0100123");
        let empty: String = conn
            .query_row("SELECT lm_normalize(NULL)", [], |row| row.get(0))
            .unwrap();
        assert_eq!(empty, "");
    }
}
