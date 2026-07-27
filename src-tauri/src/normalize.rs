pub fn normalize_phone(value: &str) -> String {
    value.chars().filter(|c| c.is_ascii_digit()).collect()
}

pub fn normalize_text(value: &str) -> String {
    value
        .chars()
        .filter_map(|c| match c {
            '\u{064B}'..='\u{065F}' | '\u{0670}' => None,
            'أ' | 'إ' | 'آ' | 'ٱ' => Some('ا'),
            'ى' => Some('ي'),
            '٠' => Some('0'),
            '١' => Some('1'),
            '٢' => Some('2'),
            '٣' => Some('3'),
            '٤' => Some('4'),
            '٥' => Some('5'),
            '٦' => Some('6'),
            '٧' => Some('7'),
            '٨' => Some('8'),
            '٩' => Some('9'),
            other => Some(other),
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
