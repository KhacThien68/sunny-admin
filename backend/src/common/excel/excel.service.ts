import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ColumnSpec {
  /** Exact header text that appears in row 1 of the Excel sheet. */
  header: string;
  /** Property name to use in the parsed row object. */
  key: string;
  required?: boolean;
  type?: 'string' | 'number' | 'enum';
  /** For type 'enum' — validated case-insensitively against this list. */
  enumValues?: string[];
}

export interface SheetSpec {
  columns: ColumnSpec[];
}

export interface RowError {
  /** 1-based Excel row number (row 1 = headers, so first data row = 2). */
  row: number;
  /** The column header text from the spec. */
  column: string;
  message: string;
}

export interface ParseResult<T = Record<string, unknown>> {
  rows: (T & { __row: number })[];
  errors: RowError[];
}

@Injectable()
export class ExcelService {
  /**
   * Build a single-sheet Excel workbook with bold header row and ~20 col widths.
   * Returns the binary buffer ready to stream as a download.
   */
  async buildTemplate(spec: SheetSpec): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');

    // Set column definitions so widths apply
    ws.columns = spec.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: 20,
    }));

    // Bold the header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.commit();

    return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * Parse an Excel file buffer against the given SheetSpec.
   *
   * - Row 1 must contain ALL spec headers (trimmed, case-sensitive).
   *   Missing headers → BadRequestException.
   * - Empty rows (all spec cells blank) are silently skipped.
   * - Per-cell validation: required, type number, type enum (case-insensitive).
   * - Rows with any error are excluded from `rows`; all errors are collected.
   */
  async parse<T = Record<string, unknown>>(
    buffer: Buffer,
    spec: SheetSpec,
  ): Promise<ParseResult<T>> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const ws = wb.worksheets[0];
    if (!ws) {
      throw new BadRequestException('File Excel không có sheet nào');
    }

    // ── Step 1: resolve header → column index mapping from row 1 ────────────
    const headerRow = ws.getRow(1);
    const headerMap = new Map<string, number>(); // header text → 1-based col index

    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = String(cell.value ?? '').trim();
      if (text) {
        headerMap.set(text, colNumber);
      }
    });

    // Validate all spec headers are present
    for (const col of spec.columns) {
      if (!headerMap.has(col.header)) {
        throw new BadRequestException(
          `Sai định dạng file mẫu: thiếu cột "${col.header}"`,
        );
      }
    }

    // ── Step 2: iterate data rows ────────────────────────────────────────────
    const rows: (T & { __row: number })[] = [];
    const errors: RowError[] = [];

    const lastRow = ws.lastRow?.number ?? 1;

    for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
      const wsRow = ws.getRow(rowNum);

      // Check if the row is entirely blank (only spec columns considered)
      const isBlank = spec.columns.every((col) => {
        const colIdx = headerMap.get(col.header)!;
        const cell = wsRow.getCell(colIdx);
        return this.cellIsEmpty(cell);
      });

      if (isBlank) continue;

      // Validate each column
      const rowErrors: RowError[] = [];
      const rowObj: Record<string, unknown> = {};

      for (const colSpec of spec.columns) {
        const colIdx = headerMap.get(colSpec.header)!;
        const cell = wsRow.getCell(colIdx);
        const rawValue = this.getCellString(cell);

        if (rawValue === null || rawValue === '') {
          if (colSpec.required) {
            rowErrors.push({
              row: rowNum,
              column: colSpec.header,
              message: 'Thiếu giá trị',
            });
          }
          // Leave key absent / undefined for optional empty cells
          continue;
        }

        // Type validation
        if (colSpec.type === 'number') {
          const num = Number(rawValue);
          if (isNaN(num)) {
            rowErrors.push({
              row: rowNum,
              column: colSpec.header,
              message: 'Giá trị phải là số',
            });
            continue;
          }
          rowObj[colSpec.key] = num;
        } else if (colSpec.type === 'enum' && colSpec.enumValues) {
          const normalized = rawValue.trim();
          const match = colSpec.enumValues.find(
            (v) => v.toLowerCase() === normalized.toLowerCase(),
          );
          if (!match) {
            rowErrors.push({
              row: rowNum,
              column: colSpec.header,
              message: 'Giá trị không hợp lệ',
            });
            continue;
          }
          rowObj[colSpec.key] = match; // store canonical enum value
        } else {
          // string (default)
          rowObj[colSpec.key] = rawValue.trim();
        }
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        // Row excluded from valid rows
      } else {
        (rowObj as T & { __row: number })['__row'] = rowNum;
        rows.push(rowObj as T & { __row: number });
      }
    }

    return { rows, errors };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private cellIsEmpty(cell: ExcelJS.Cell): boolean {
    return (
      cell.value === null ||
      cell.value === undefined ||
      String(cell.value).trim() === ''
    );
  }

  /**
   * Return the cell value as a trimmed string, or null if empty.
   * Handles ExcelJS rich-text objects, dates, booleans, etc.
   */
  private getCellString(cell: ExcelJS.Cell): string | null {
    const val = cell.value;
    if (val === null || val === undefined) return null;

    let str: string;

    if (typeof val === 'object' && 'richText' in val) {
      // Rich text
      str = (val as ExcelJS.CellRichTextValue).richText
        .map((r) => r.text)
        .join('');
    } else if (typeof val === 'object' && 'result' in val) {
      // Formula cell
      str = String((val as ExcelJS.CellFormulaValue).result ?? '');
    } else {
      str = String(val);
    }

    const trimmed = str.trim();
    return trimmed === '' ? null : trimmed;
  }
}
