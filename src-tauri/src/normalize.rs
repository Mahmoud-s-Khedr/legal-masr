pub fn normalize_phone(value: &str) -> String {
    value.chars().filter(|c| c.is_ascii_digit()).collect()
}

pub fn normalize_text(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
