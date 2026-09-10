"""
Docling Parser integration with FastOCR / RapidOCR support.
Extracts clean Markdown and structured DocumentNode elements from PDFs and documents.
"""
from pathlib import Path
from typing import List, Dict, Any, Optional
import time

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
from docling.datamodel.base_models import InputFormat

from rag_engine.schema import DocumentNode

class DoclingParser:
    """
    High-performance Document Parser using Docling with RapidOCR/FastOCR acceleration.
    """
    def __init__(self, use_ocr: bool = True, force_full_page_ocr: bool = False):
        self.use_ocr = use_ocr
        self.pipeline_options = PdfPipelineOptions()
        self.pipeline_options.do_ocr = use_ocr
        self.pipeline_options.do_table_structure = True
        
        # Configure RapidOCR (FastOCR backend)
        if use_ocr:
            ocr_options = RapidOcrOptions(force_full_page_ocr=force_full_page_ocr)
            self.pipeline_options.ocr_options = ocr_options
            
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=self.pipeline_options)
            }
        )

    def parse_file(self, file_path: str | Path) -> Dict[str, Any]:
        """
        Parse a PDF or document file into structured text, markdown and AST nodes.
        
        Returns:
            Dict with 'markdown', 'text', 'nodes', 'tables', 'metadata', 'elapsed_sec'
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        start_time = time.time()
        conv_result = self.converter.convert(str(path))
        doc = conv_result.document
        elapsed_sec = time.time() - start_time

        # Export full markdown
        markdown_text = doc.export_to_markdown()
        plain_text = doc.export_to_text()

        # Extract structured nodes
        nodes: List[DocumentNode] = []
        current_hierarchy: List[str] = []

        for item, level in doc.iterate_items():
            item_type = type(item).__name__.lower()
            text_content = ""
            
            if hasattr(item, "text") and item.text:
                text_content = item.text
            elif hasattr(item, "export_to_markdown"):
                try:
                    text_content = item.export_to_markdown(doc=doc)
                except Exception:
                    try:
                        text_content = item.export_to_markdown()
                    except Exception:
                        text_content = str(item)
            else:
                text_content = ""

            if not text_content.strip():
                continue

            page_num = 1
            if hasattr(item, "prov") and item.prov:
                page_num = item.prov[0].page_no

            if "heading" in item_type or "title" in item_type:
                # Update hierarchy
                if level < len(current_hierarchy):
                    current_hierarchy = current_hierarchy[:level]
                current_hierarchy.append(text_content.strip())

            node = DocumentNode(
                text=text_content.strip(),
                element_type=item_type,
                page_number=page_num,
                section_hierarchy=list(current_hierarchy),
                metadata={
                    "doc_name": path.name,
                    "level": level
                }
            )
            nodes.append(node)

        # Extract tables
        tables = []
        if hasattr(doc, "tables"):
            for t in doc.tables:
                try:
                    t_md = t.export_to_markdown(doc=doc)
                except Exception:
                    try:
                        t_md = t.export_to_markdown()
                    except Exception:
                        t_md = str(t)
                nrows = None
                if hasattr(t, "num_rows"):
                    nr = getattr(t, "num_rows")
                    nrows = nr() if callable(nr) else nr
                ncols = None
                if hasattr(t, "num_cols"):
                    nc = getattr(t, "num_cols")
                    ncols = nc() if callable(nc) else nc

                tables.append({
                    "markdown": t_md,
                    "num_rows": int(nrows) if isinstance(nrows, (int, float)) else None,
                    "num_cols": int(ncols) if isinstance(ncols, (int, float)) else None
                })

        npages = getattr(doc, "num_pages", 1)
        if callable(npages):
            try:
                npages = npages()
            except Exception:
                npages = 1

        return {
            "file_name": path.name,
            "markdown": markdown_text,
            "text": plain_text,
            "nodes": nodes,
            "tables": tables,
            "num_pages": int(npages) if isinstance(npages, (int, float)) else 1,
            "elapsed_sec": elapsed_sec
        }
