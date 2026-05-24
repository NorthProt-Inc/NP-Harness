---
name: fill-pdf
description: 'Fill a fillable or flat PDF form using a reportlab overlay-merge approach. Avoids the blank-field rendering bug that annotation-field edits exhibit in some viewers (Preview, Chrome PDF, some mobile readers). Use when user asks to fill, complete, or draft a PDF form from a data source (markdown, docx, JSON, or dictated fields).

  '
metadata:
  openclaw:
    category: document-automation
    requires:
      bins:
      - python3
      - pdftoppm
      python:
      - reportlab
      - pypdf
  version: 1.0.0
---

# Fill PDF Form (reportlab overlay)

**Announce at start:** "Running fill-pdf: building reportlab overlay and merging onto original PDF."

## When to use

- User asks to fill, complete, or draft a PDF form.
- Source data lives in markdown, docx, JSON, plain-text dictation, or a cheatsheet.
- Target PDF may be a fillable AcroForm or a flat scan — this skill handles both.

## Why overlay, not annotation edits

Annotation-field writes (`pypdf.update_page_form_field_values`) work in Adobe Acrobat but render blank in Apple Preview, Chrome PDF viewer, and several mobile readers. Overlay-merge flattens text onto the page as real page content — universally visible.

## Pipeline

### 1. Inspect the target PDF

```python
from pypdf import PdfReader
r = PdfReader("original.pdf")
print(r.pages[0].mediabox)            # usually (0, 0, 612, 792) for US Letter
print(r.get_fields() or "no AcroForm")
```

If AcroForm fields exist, their rects give you a coordinate starting point. Otherwise, open the PDF visually and note approximate `(x, y)` for each field — origin is bottom-left in reportlab and PDF coordinates.

### 2. Collect data

- Read the source (markdown / docx / JSON / dictation).
- Normalize into a `{field_name: value}` dict.
- Flag missing required fields and surface to the user BEFORE rendering.

### 3. Build the reportlab overlay

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

c = canvas.Canvas("overlay.pdf", pagesize=letter)
c.setFont("Helvetica", 10)
for name, (x, y) in field_coords.items():
    c.drawString(x, y, data[name])
c.save()
```

- Default to `Helvetica` or `Helvetica-Bold` unless the form dictates otherwise.
- Multi-page forms: call `c.showPage()` between pages and render each page's fields in order on its own canvas page.
- Checkboxes: `c.drawString(x, y, "X")` or a filled rectangle `c.rect(x, y, w, h, fill=1)`.

### 4. Merge overlay onto original

```python
from pypdf import PdfReader, PdfWriter

base = PdfReader("original.pdf")
over = PdfReader("overlay.pdf")
writer = PdfWriter()
for i, page in enumerate(base.pages):
    if i < len(over.pages):
        page.merge_page(over.pages[i])
    writer.add_page(page)
with open("filled.pdf", "wb") as f:
    writer.write(f)
```

### 5. Preview before upload

```bash
pdftoppm filled.pdf preview -png -r 150
```

Show the preview PNG to the user. Do NOT auto-upload to Drive, email, or submit anywhere. Iterate on coordinates if alignment is off — typical tweak is ±2–5 pt in x or y.

### 6. Upload / submit ONLY after user approval

Use the appropriate skill or CLI (`gws-drive`, `gws-gmail`, etc.) for final delivery.

## Coordinate debugging tips

- reportlab origin: bottom-left. PDF standard origin: bottom-left. No flip needed.
- `canvas.Canvas` default `pagesize=letter` = `(612, 792)` points.
- Text baseline sits AT the y-coordinate. For a field rect at `y=200` height 14, draw at `y≈204` to vertically center.
- If everything is shifted uniformly, adjust with one `c.translate(dx, dy)` call instead of editing every coordinate.

## Do not

- Do not use `update_page_form_field_values` as the primary path — it fails silently in common viewers.
- Do not flatten with `writer.add_annotation(None)` hacks.
- Do not auto-upload, email, or submit before showing a preview and getting user approval.

## Edge cases

- **Scanned PDFs:** treat as flat; overlay works identically.
- **Encrypted PDFs:** `reader.decrypt(password)` — ask the user for the password, never guess.
- **Rotated pages:** check `page.rotation`; if non-zero, rotate the overlay canvas to match before merging.
- **Asian / accented characters:** register a TTF font before `setFont`:
  ```python
  from reportlab.pdfbase import pdfmetrics
  from reportlab.pdfbase.ttfonts import TTFont
  pdfmetrics.registerFont(TTFont('NotoSans', '/path/to/NotoSans-Regular.ttf'))
  c.setFont('NotoSans', 10)
  ```
