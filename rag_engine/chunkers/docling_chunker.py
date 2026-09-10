"""
Docling Layout & Structure-Aware Chunker.
Leverages document AST, header hierarchy, and preserves tables/lists without mid-row tearing.
"""
from typing import List, Dict, Any, Optional
from rag_engine.chunkers.base import BaseChunker
from rag_engine.schema import Chunk, DocumentNode

class DoclingStructureChunker(BaseChunker):
    """
    Structure-Aware Chunking based on Docling AST & Markdown sections.
    """
    def __init__(self, max_tokens: int = 512, include_breadcrumbs: bool = True):
        super().__init__(name="Docling_Structure_Aware", chunk_size=max_tokens)
        self.max_tokens = max_tokens
        self.include_breadcrumbs = include_breadcrumbs

    def chunk(
        self,
        text: str,
        nodes: Optional[List[DocumentNode]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[Chunk]:
        base_meta = metadata or {}
        
        if not nodes:
            # Fallback if no AST nodes provided: split by markdown headings
            return self._chunk_from_markdown(text, base_meta)

        chunks: List[Chunk] = []
        current_texts: List[str] = []
        current_tokens = 0
        current_hierarchy: List[str] = []
        current_pages: List[int] = []

        def flush_chunk():
            nonlocal current_texts, current_tokens, current_hierarchy, current_pages
            if not current_texts:
                return
            
            chunk_body = "\n\n".join(current_texts).strip()
            if self.include_breadcrumbs and current_hierarchy:
                breadcrumb = " > ".join(current_hierarchy)
                final_text = f"[{breadcrumb}]\n{chunk_body}"
            else:
                final_text = chunk_body

            meta = dict(base_meta)
            meta["strategy"] = self.name
            meta["hierarchy"] = list(current_hierarchy)
            meta["pages"] = sorted(list(set(current_pages)))
            meta["chunk_index"] = len(chunks)

            chunks.append(Chunk(
                text=final_text,
                metadata=meta,
                token_count=self.count_tokens(final_text)
            ))
            current_texts = []
            current_tokens = 0
            current_pages = []

        for node in nodes:
            node_tokens = self.count_tokens(node.text)
            is_heading = "heading" in node.element_type or "title" in node.element_type
            is_table = "table" in node.element_type

            # If node is a new major heading or table exceeds limit, flush previous buffer
            if is_heading and current_tokens > 0:
                flush_chunk()
                current_hierarchy = node.section_hierarchy

            if is_table:
                # Tables are preserved intact as atomic units
                if current_tokens > 0 and (current_tokens + node_tokens > self.max_tokens):
                    flush_chunk()
                current_texts.append(node.text)
                current_pages.append(node.page_number)
                current_tokens += node_tokens
                flush_chunk()
                continue

            if current_tokens + node_tokens > self.max_tokens and current_texts:
                flush_chunk()

            current_texts.append(node.text)
            current_pages.append(node.page_number)
            current_tokens += node_tokens
            if node.section_hierarchy:
                current_hierarchy = node.section_hierarchy

        flush_chunk()
        return chunks

    def _chunk_from_markdown(self, markdown_text: str, base_meta: Dict[str, Any]) -> List[Chunk]:
        """Fallback markdown section splitter."""
        lines = markdown_text.splitlines()
        sections = []
        cur_sec = []
        cur_heading = ""

        for line in lines:
            if line.startswith("#"):
                if cur_sec:
                    sections.append((cur_heading, "\n".join(cur_sec)))
                    cur_sec = []
                cur_heading = line.strip()
            cur_sec.append(line)
            
        if cur_sec:
            sections.append((cur_heading, "\n".join(cur_sec)))

        chunks = []
        for i, (head, body) in enumerate(sections):
            text = f"{head}\n{body}".strip() if head and not body.startswith(head) else body.strip()
            chunks.append(Chunk(
                text=text,
                metadata={**base_meta, "chunk_index": i, "heading": head, "strategy": self.name},
                token_count=self.count_tokens(text)
            ))
        return chunks
