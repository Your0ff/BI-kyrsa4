# -*- coding: utf-8 -*-
"""Сборка отчёта по курсовой работе (тема: демография моногородов).

Запуск:  python report/build_report.py
Результат: Ot4et_monogoroda.docx в корне проекта.
"""

import os

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FONT = "Times New Roman"
BASE_SIZE = Pt(14)
SMALL_SIZE = Pt(12)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "Ot4et_monogoroda.docx")


# --------------------------------------------------------------------------- #
#  Служебные функции оформления
# --------------------------------------------------------------------------- #
def force_font(run, size=BASE_SIZE, bold=False, italic=False):
    run.font.name = FONT
    run.font.size = size
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = RGBColor(0, 0, 0)
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.append(fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        fonts.set(qn(attr), FONT)


def setup_document():
    doc = Document()

    section = doc.sections[0]
    section.left_margin = Cm(3)
    section.right_margin = Cm(1.5)
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = BASE_SIZE
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    for name, align, before, after in (
        ("Heading 1", WD_ALIGN_PARAGRAPH.CENTER, 12, 12),
        ("Heading 2", WD_ALIGN_PARAGRAPH.LEFT, 12, 6),
    ):
        style = doc.styles[name]
        style.font.name = FONT
        style.font.size = BASE_SIZE
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.paragraph_format.alignment = align
        style.paragraph_format.first_line_indent = Cm(0 if name == "Heading 1" else 1.25)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.line_spacing = 1.5
        style.paragraph_format.keep_with_next = True

    add_page_numbers(doc)
    return doc


def add_page_numbers(doc):
    footer = doc.sections[0].footer
    par = footer.paragraphs[0]
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = par.add_run()
    force_font(run, Pt(12))
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)


def add_toc(doc):
    par = doc.add_paragraph()
    par.paragraph_format.first_line_indent = Cm(0)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), 'TOC \\o "1-2" \\h \\z \\u')
    run = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "Оглавление обновляется автоматически: выделите его и нажмите F9"
    run.append(t)
    fld.append(run)
    par._p.append(fld)


# --------------------------------------------------------------------------- #
#  Блоки содержимого
# --------------------------------------------------------------------------- #
def add_h1(doc, text, first=False):
    if not first:
        brk = doc.add_paragraph()
        brk.paragraph_format.first_line_indent = Cm(0)
        brk.add_run().add_break(WD_BREAK.PAGE)
    par = doc.add_paragraph(style="Heading 1")
    par.paragraph_format.first_line_indent = Cm(0)
    force_font(par.add_run(text), BASE_SIZE, bold=True)


def add_h2(doc, text):
    par = doc.add_paragraph(style="Heading 2")
    par.paragraph_format.first_line_indent = Cm(1.25)
    force_font(par.add_run(text), BASE_SIZE, bold=True)


def add_p(doc, text, indent=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    par = doc.add_paragraph()
    par.paragraph_format.first_line_indent = Cm(1.25 if indent else 0)
    par.paragraph_format.line_spacing = 1.5
    par.alignment = align
    force_font(par.add_run(text))
    return par


def add_bullets(doc, items):
    for item in items:
        par = doc.add_paragraph()
        par.paragraph_format.first_line_indent = Cm(1.25)
        par.paragraph_format.line_spacing = 1.5
        par.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        force_font(par.add_run("\u2013 " + item))


def add_caption(doc, text, align=WD_ALIGN_PARAGRAPH.LEFT):
    par = doc.add_paragraph()
    par.paragraph_format.first_line_indent = Cm(0)
    par.paragraph_format.line_spacing = 1.5
    par.paragraph_format.space_after = Pt(6)
    par.alignment = align
    force_font(par.add_run(text))


def add_table(doc, caption, rows, widths=None):
    add_caption(doc, caption)
    table = doc.add_table(rows=len(rows), cols=len(rows[0]))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r_idx, row in enumerate(rows):
        for c_idx, value in enumerate(row):
            cell = table.cell(r_idx, c_idx)
            cell.text = ""
            par = cell.paragraphs[0]
            par.paragraph_format.first_line_indent = Cm(0)
            par.paragraph_format.line_spacing = 1.0
            par.paragraph_format.space_after = Pt(2)
            par.paragraph_format.space_before = Pt(2)
            par.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_idx == 0 else WD_ALIGN_PARAGRAPH.LEFT
            force_font(par.add_run(value), SMALL_SIZE, bold=(r_idx == 0))
    if widths:
        for c_idx, width in enumerate(widths):
            for row in table.rows:
                row.cells[c_idx].width = Cm(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)


def add_figure(doc, caption, image=None):
    par = doc.add_paragraph()
    par.paragraph_format.first_line_indent = Cm(0)
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par.paragraph_format.space_before = Pt(6)
    par.paragraph_format.keep_with_next = True
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img", image) if image else None
    if path and os.path.exists(path):
        from PIL import Image

        width_cm, height_cm = 11.5, None
        with Image.open(path) as im:
            px_w, px_h = im.size
        height_cm = width_cm * px_h / px_w
        if height_cm > 12.5:
            width_cm = width_cm * 12.5 / height_cm
        par.add_run().add_picture(path, width=Cm(width_cm))
    else:
        force_font(par.add_run("[место для скриншота]"), Pt(12), italic=True)
    add_caption(doc, caption, align=WD_ALIGN_PARAGRAPH.CENTER)


def render(doc, blocks):
    first_h1 = True
    for block in blocks:
        kind = block[0]
        if kind == "h1":
            add_h1(doc, block[1], first=first_h1)
            first_h1 = False
        elif kind == "h2":
            add_h2(doc, block[1])
        elif kind == "p":
            add_p(doc, block[1])
        elif kind == "bul":
            add_bullets(doc, block[1])
        elif kind == "table":
            add_table(doc, block[1], block[2], block[3] if len(block) > 3 else None)
        elif kind == "fig":
            add_figure(doc, block[1], block[2] if len(block) > 2 else None)
        else:
            raise ValueError("неизвестный блок: %r" % (kind,))


def title_page(doc):
    def line(text, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, size=BASE_SIZE, space_after=0):
        par = doc.add_paragraph()
        par.paragraph_format.first_line_indent = Cm(0)
        par.paragraph_format.line_spacing = 1.5
        par.paragraph_format.space_after = Pt(space_after)
        par.alignment = align
        force_font(par.add_run(text), size, bold=bold)
        return par

    line("Министерство науки и высшего образования Российской Федерации")
    line("Федеральное государственное бюджетное образовательное учреждение")
    line("высшего образования")
    line("«Брянский государственный инженерно-технологический университет»")
    line("Кафедра «Информационные технологии»")
    for _ in range(2):
        line("")
    line("КУРСОВАЯ РАБОТА", bold=True, size=Pt(16))
    line("по дисциплине: «Бизнес-аналитика»")
    line(
        "Приложение для анализа данных «Динамика естественного и миграционного "
        "движения населения в моногородах России»",
        bold=True,
    )
    line("КР-02068025-09.03.03-044.26")
    for _ in range(3):
        line("")

    def field(label, value):
        par = doc.add_paragraph()
        par.paragraph_format.first_line_indent = Cm(0)
        par.paragraph_format.line_spacing = 1.5
        par.alignment = WD_ALIGN_PARAGRAPH.LEFT
        force_font(par.add_run("%s%s" % (label, value)))

    field("Автор работы: ", "______________")
    field("Группа: ", "______________")
    field("№ зачётной книжки: ", "______________")
    field("Руководитель работы: ", "канд. экон. наук, доцент   Азаренко Н.Ю.")
    field("Нормоконтроль: ", "канд. экон. наук, доцент   Азаренко Н.Ю.")
    field("Доступ к защите: ", "«__»____________ 20__ г.")
    field("Дата защиты: ", "«__»____________ 20__ г.")
    field("Оценка: ", "______________")
    field("Члены комиссии: ", "______________")
    line("Брянск 2026").paragraph_format.space_before = Pt(36)

CONTENT = []


def contents_page(doc):
    par = doc.add_paragraph()
    par.paragraph_format.first_line_indent = Cm(0)
    par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par.paragraph_format.space_after = Pt(12)
    force_font(par.add_run("СОДЕРЖАНИЕ"), BASE_SIZE, bold=True)
    add_toc(doc)


def main():
    import importlib
    import sys

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    blocks = []
    for module_name in ("content_1", "content_2", "content_3", "content_4"):
        module = importlib.import_module(module_name)
        blocks.extend(module.BLOCKS)

    doc = setup_document()
    title_page(doc)

    brk = doc.add_paragraph()
    brk.paragraph_format.first_line_indent = Cm(0)
    brk.add_run().add_break(WD_BREAK.PAGE)

    contents_page(doc)
    render(doc, blocks)

    doc.save(OUT)
    print("saved:", OUT)
    print("blocks:", len(blocks))


if __name__ == "__main__":
    main()
