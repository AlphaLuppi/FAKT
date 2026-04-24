//! Extraction robuste de JSON depuis une sortie texte de Claude CLI.
//!
//! Contexte : même avec des instructions strictes "réponds uniquement en JSON",
//! Claude emet régulièrement du contexte autour (markdown fences, prefixe
//! explicatif, emoji, etc.). Un `serde_json::from_str` direct échoue et on
//! retombait sur une String côté TS → UI affichait "0 items / 0€".
//!
//! Ce module tente plusieurs stratégies dans l'ordre :
//!   1. Parse direct (cas nominal, texte = JSON pur).
//!   2. Strip des fences markdown ```json ... ``` (ou ``` génériques).
//!   3. Scan brace-balanced depuis le premier `{` jusqu'à la fermeture
//!      correspondante (gère les strings échappées).
//!   4. Fallback : retourne `None` — l'appelant garde le texte brut et
//!      remonte un warning.

use serde_json::Value;

/// Tente d'extraire un `serde_json::Value` depuis une sortie texte.
/// Retourne `None` si aucune stratégie ne produit un JSON valide.
pub fn extract_json(text: &str) -> Option<Value> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Stratégie 1 — parse direct.
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return Some(v);
    }

    // Stratégie 2 — strip fences markdown.
    if let Some(inner) = strip_markdown_fences(trimmed) {
        if let Ok(v) = serde_json::from_str::<Value>(&inner) {
            return Some(v);
        }
    }

    // Stratégie 3 — scan brace-balanced depuis le premier `{`.
    if let Some(candidate) = scan_first_balanced_object(trimmed) {
        if let Ok(v) = serde_json::from_str::<Value>(&candidate) {
            return Some(v);
        }
    }

    // Stratégie 3bis — même chose pour un array JSON `[...]` au cas où
    // le modèle renvoie une liste d'items directement.
    if let Some(candidate) = scan_first_balanced_array(trimmed) {
        if let Ok(v) = serde_json::from_str::<Value>(&candidate) {
            return Some(v);
        }
    }

    None
}

/// Retire les triple backticks `\`\`\`json\n...\n\`\`\`` ou `\`\`\`\n...\n\`\`\``.
/// Retourne None si le pattern n'est pas détecté proprement.
fn strip_markdown_fences(text: &str) -> Option<String> {
    let text = text.trim();
    // Cherche la première occurrence de "```".
    let start_fence = text.find("```")?;
    let after_open = &text[start_fence + 3..];

    // Optionnel : le label de langage (ex: "json"). On avance jusqu'au newline.
    let content_start = after_open.find('\n').map(|i| i + 1).unwrap_or(0);
    let remainder = &after_open[content_start..];

    // Cherche le fence de clôture.
    let end_fence = remainder.rfind("```")?;
    let inner = &remainder[..end_fence];
    Some(inner.trim().to_string())
}

/// Scanne le texte depuis le premier `{` trouvé et retourne la substring
/// correspondant au premier objet JSON balancé trouvé.
///
/// Gère correctement les strings JSON (les `{` et `}` à l'intérieur ne
/// comptent pas pour le solde).
fn scan_first_balanced_object(text: &str) -> Option<String> {
    scan_first_balanced(text, '{', '}')
}

/// Idem pour les tableaux JSON.
fn scan_first_balanced_array(text: &str) -> Option<String> {
    scan_first_balanced(text, '[', ']')
}

fn scan_first_balanced(text: &str, open: char, close: char) -> Option<String> {
    let bytes = text.as_bytes();
    let mut start: Option<usize> = None;
    let mut depth: i32 = 0;
    let mut in_string = false;
    let mut escape = false;

    for (i, &b) in bytes.iter().enumerate() {
        let ch = b as char;
        if in_string {
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }
        if ch == '"' {
            in_string = true;
            continue;
        }
        if ch == open {
            if start.is_none() {
                start = Some(i);
            }
            depth += 1;
        } else if ch == close {
            if depth > 0 {
                depth -= 1;
                if depth == 0 {
                    if let Some(s) = start {
                        return Some(text[s..=i].to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_raw_json() {
        let raw = r#"{"items": [{"description": "hosting", "quantity": 1, "unitPrice": 100, "unit": "forfait"}]}"#;
        let v = extract_json(raw).expect("should parse raw JSON");
        assert!(v.get("items").is_some());
    }

    #[test]
    fn parses_json_inside_markdown_fences() {
        let raw = "Voici le JSON que tu veux :\n```json\n{\"items\": [{\"description\": \"x\", \"quantity\": 1, \"unitPrice\": 100, \"unit\": \"forfait\"}]}\n```\n";
        let v = extract_json(raw).expect("should strip fences");
        assert!(v.get("items").is_some());
    }

    #[test]
    fn parses_json_inside_plain_fences() {
        let raw = "```\n{\"a\": 1}\n```";
        let v = extract_json(raw).expect("should strip plain fences");
        assert_eq!(v["a"], 1);
    }

    #[test]
    fn parses_json_with_prefix_text() {
        let raw = "Bien sûr ! Voici votre réponse :\n\n{\"items\": [], \"notes\": \"hello\"}";
        let v = extract_json(raw).expect("should scan past prefix");
        assert_eq!(v["notes"], "hello");
    }

    #[test]
    fn parses_json_with_prefix_and_suffix() {
        let raw = "Analyse :\n{\"ok\": true}\nFin.";
        let v = extract_json(raw).expect("should find object despite suffix");
        assert_eq!(v["ok"], true);
    }

    #[test]
    fn handles_nested_braces_in_strings() {
        let raw = "{\"note\": \"J'ai un { dans ma description\", \"ok\": true}";
        let v = extract_json(raw).expect("should handle braces inside strings");
        assert_eq!(v["ok"], true);
    }

    #[test]
    fn returns_none_for_plain_text() {
        let raw = "Je n'ai pas compris la demande, peux-tu préciser ?";
        assert!(extract_json(raw).is_none());
    }

    #[test]
    fn returns_none_for_empty_string() {
        assert!(extract_json("").is_none());
        assert!(extract_json("   \n\t  ").is_none());
    }

    #[test]
    fn parses_array_output() {
        let raw = "[{\"a\": 1}, {\"a\": 2}]";
        let v = extract_json(raw).expect("should parse arrays");
        assert!(v.is_array());
    }

    #[test]
    fn parses_fenced_json_with_complex_content() {
        let raw = r#"Voici le JSON extrait du brief :

```json
{
  "client": {
    "name": "Casa Mia",
    "email": null,
    "address": null,
    "phone": null,
    "siret": null
  },
  "items": [
    {
      "description": "Hébergement annuel du site web",
      "quantity": 1,
      "unitPrice": 100,
      "unit": "forfait"
    }
  ],
  "validUntil": null,
  "notes": "Site web gratuit, seul l'hébergement est facturé.",
  "depositPercent": null
}
```

J'espère que cela correspond à vos attentes !"#;
        let v = extract_json(raw).expect("should parse complex fenced json");
        assert_eq!(v["client"]["name"], "Casa Mia");
        assert_eq!(v["items"].as_array().unwrap().len(), 1);
        assert_eq!(v["items"][0]["unitPrice"], 100);
    }

    #[test]
    fn scan_balanced_respects_escaped_quotes() {
        let raw = r#"{"text": "hello \"world\""}"#;
        let v = extract_json(raw).expect("should handle escaped quotes");
        assert_eq!(v["text"], "hello \"world\"");
    }
}
