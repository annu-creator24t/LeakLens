import csv
import io
from typing import List, Dict, Any, Tuple


class CSVParserService:
    @staticmethod
    def parse_bytes(file_bytes: bytes) -> Tuple[List[str], List[Dict[str, str]], List[str]]:
        """
        Parses raw CSV bytes into headers and row dictionaries.
        Supports UTF-8, UTF-8-SIG (strips BOM), and Latin-1 fallback.
        Returns: (headers, rows, parse_errors)
        """
        if not file_bytes or len(file_bytes.strip()) == 0:
            return [], [], ["The uploaded file is empty."]

        # Decode content with encoding fallbacks
        decoded_text = None
        for encoding in ("utf-8-sig", "utf-8", "latin-1"):
            try:
                decoded_text = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue

        if decoded_text is None:
            return [], [], ["Malformed file encoding: could not decode file as UTF-8 or Latin-1."]

        # Standardize line breaks
        decoded_text = decoded_text.replace("\r\n", "\n").replace("\r", "\n")
        
        # Check if file has only whitespace
        if not decoded_text.strip():
            return [], [], ["The uploaded file contains only whitespace or empty lines."]

        buffer = io.StringIO(decoded_text)
        try:
            reader = csv.reader(buffer)
            raw_headers = next(reader, None)
            if raw_headers is None:
                return [], [], ["Could not extract header row from CSV."]

            # Clean and normalize header names (strip spaces, lowercase)
            headers = [h.strip().lower() for h in raw_headers]
            
            # Reset buffer to parse with DictReader
            buffer.seek(0)
            dict_reader = csv.DictReader(buffer)
            # Override fieldnames with stripped lowercased names
            dict_reader.fieldnames = headers

            # Skip header line in DictReader iteration
            next(dict_reader, None)

            rows: List[Dict[str, str]] = []
            row_idx = 2  # 1-indexed (row 1 is header)
            for row in dict_reader:
                # Check for completely empty line
                if not any(v.strip() for v in row.values() if v is not None):
                    continue
                # Clean up each field value
                cleaned_row = {k: (v.strip() if v is not None else "") for k, v in row.items()}
                cleaned_row["_row_number"] = str(row_idx)
                rows.append(cleaned_row)
                row_idx += 1

            if not rows:
                return headers, [], ["The uploaded CSV contains a header but no data rows."]

            return headers, rows, []

        except csv.Error as e:
            return [], [], [f"Malformed CSV syntax error: {str(e)}"]
        except Exception as e:
            return [], [], [f"Unexpected error while parsing CSV: {str(e)}"]


csv_parser = CSVParserService()
