const KUPCA_POSITIVE =
  /kupçalı|kupcali|paket\s*kupça|paket\s*kupca|\bkupça\b|\bkupca\b|çıxarış(?:ı|in|ın)?\s+var|cixaris(?:i)?\s+var|çıxarışlı|cixarisli|rəsmi\s+sənəd|resmi\s+sened|has_bill_of_sale|title\s*deed|hasTitleDeed/iu;

const KUPCA_LABEL = /çıxarış\s*\(\s*kupça\s*\)|kupça\s*\(\s*çıxarış\s*\)|çıxarış|cixaris|kupça|kupca/iu;

const BELEDIYE =
  /bələdiyyə\s+sənədi|belediyye\s+senedi|bəlediye\s+sənədi|bələdiyyə\s+şəhadətnaməsi|belediyye\s+shehadetnamesi|bələdiyyə\s+senedi/iu;

const DOC_TYPE_BELEDIYE =
  /sənədin\s+tipi\s*[:\s]*bələdiyyə|senedin\s+tipi\s*[:\s]*belediy|sənədi\s*[:\s]*bələdiyyə|senedi\s*[:\s]*belediy/iu;

const DOC_TYPE_KUPCA =
  /sənədin\s+tipi\s*[:\s]*(çıxarış|kupça)|senedin\s+tipi\s*[:\s]*(cixaris|kupca)|sənədi\s*(?:çıxarış|cixaris)|sənədi\s*[:\s]*(çıxarış|kupça|kupca)|sənəd\s+vəziyyəti\s*[:\s]*(çıxarış|kupça)|"name"\s*:\s*"sənəd"\s*,\s*"value"\s*:\s*"kupça"/iu;

const NEGATIVE =
  /kupçasız|kupcasiz|kupça\s+yoxdur|kupca\s+yoxdur|çıxarış\s+yoxdur|cixaris\s+yoxdur|çıxarışı\s+yoxdur/iu;

function stripNoise(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/name=["']emlak_senedi\[\]["'][\s\S]{0,400}/giu, " ")
    .replace(/id=["']property-doc-\d+["'][\s\S]{0,200}/giu, " ")
    .replace(/<article\b[^>]*class=["'][^"']*bt-card[^"']*["'][\s\S]*?<\/article>/giu, " ")
    .replace(/<li\b[^>]*class=["'][^"']*new_elan_box[^"']*["'][\s\S]*?<\/li>/giu, " ")
    .replace(/<div\b[^>]*class=["'][^"']*prop_col[^"']*["'][\s\S]*?<\/div>/giu, " ")
    .replace(/<button\b[^>]*kupca_ico[^>]*>[\s\S]*?<\/button>/giu, " ")
    .replace(/data-info=["']Kupça var["']/giu, " ")
    .replace(/<img\b[^>]*(?:document\.svg|alt=["']Əmlak kupça["'])[^>]*>/giu, " ")
    .replace(/data-bs-content=["']Kupça["']/giu, " ");
}

export function normalizeDocumentText(raw) {
  return stripNoise(raw)
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;|&#160;|\u00a0/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function structuredKind(html) {
  const raw = String(html || "");
  if (DOC_TYPE_BELEDIYE.test(raw) || DOC_TYPE_BELEDIYE.test(normalizeDocumentText(raw))) {
    return "belediye";
  }
  if (DOC_TYPE_KUPCA.test(raw) || DOC_TYPE_KUPCA.test(normalizeDocumentText(raw))) {
    return "kupca";
  }
  const jsonLd = /"name"\s*:\s*"Sənəd"\s*,\s*"value"\s*:\s*"([^"]+)"/iu.exec(raw);
  if (jsonLd) {
    const value = jsonLd[1];
    if (BELEDIYE.test(value)) {
      return "belediye";
    }
    if (KUPCA_LABEL.test(value)) {
      return "kupca";
    }
  }
  return null;
}

export function detectKupca(htmlOrText) {
  const raw = String(htmlOrText || "");
  const text = normalizeDocumentText(raw);
  const structured = structuredKind(raw);
  if (structured === "belediye") {
    return { kind: "belediye", hasKupca: false };
  }
  if (structured === "kupca") {
    return { kind: "kupca", hasKupca: true };
  }

  const belediye = BELEDIYE.test(text) || DOC_TYPE_BELEDIYE.test(text);
  const denied = NEGATIVE.test(text);
  const kupca = !denied && (KUPCA_POSITIVE.test(text) || KUPCA_LABEL.test(text));

  if (belediye && !kupca) {
    return { kind: "belediye", hasKupca: false };
  }
  if (belediye && kupca) {
    return { kind: "belediye", hasKupca: false };
  }
  if (kupca) {
    return { kind: "kupca", hasKupca: true };
  }
  return { kind: "none", hasKupca: false };
}

export function hasOfficialKupca(htmlOrText) {
  return detectKupca(htmlOrText).hasKupca;
}
