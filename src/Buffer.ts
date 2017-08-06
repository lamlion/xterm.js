/**
 * @license MIT
 */

import { ITerminal, IBuffer } from './Interfaces';
import { CircularList } from './utils/CircularList';
import { LineData, CharData } from './Types';

/**
 * This class represents a terminal buffer (an internal state of the terminal), where the
 * following information is stored (in high-level):
 *   - text content of this particular buffer
 *   - cursor position
 *   - scroll position
 */
export class Buffer implements IBuffer {
  private _lines: CircularList<LineData>;

  public ydisp: number;
  public ybase: number;
  public y: number;
  public x: number;
  public scrollBottom: number;
  public scrollTop: number;
  public tabs: any;
  public savedY: number;
  public savedX: number;

  /**
   * Create a new Buffer.
   * @param {Terminal} _terminal - The terminal the Buffer will belong to
   * @param {number} ydisp - The scroll position of the Buffer in the viewport
   * @param {number} ybase - The scroll position of the y cursor (ybase + y = the y position within the Buffer)
   * @param {number} y - The cursor's y position after ybase
   * @param {number} x - The cursor's x position after ybase
   */
  constructor(
    private _terminal: ITerminal
  ) {
    this.clear();
  }

  public get lines(): CircularList<LineData> {
    return this._lines;
  }

  public fillViewportRows(): void {
    if (this._lines.length === 0) {
      let i = this._terminal.rows;
      while (i--) {
        this.lines.push(this._terminal.blankLine());
      }
    }
  }

  public clear(): void {
    this.ydisp = 0;
    this.ybase = 0;
    this.y = 0;
    this.x = 0;
    this.scrollBottom = 0;
    this.scrollTop = 0;
    this.tabs = {};
    this._lines = new CircularList<LineData>(this._terminal.options.scrollback);
    this.scrollBottom = this._terminal.rows - 1;
  }

  public resize(newCols: number, newRows: number): void {
    // Don't resize the buffer if it's empty and hasn't been used yet.
    if (this._lines.length === 0) {
      return;
    }

    // Deal with columns increasing (we don't do anything when columns reduce)
    if (this._terminal.cols < newCols) {
      const ch: CharData = [this._terminal.defAttr, ' ', 1]; // does xterm use the default attr?
      for (let i = 0; i < this._lines.length; i++) {
        if (this._lines.get(i) === undefined) {
          this._lines.set(i, this._terminal.blankLine());
        }
        while (this._lines.get(i).length < newCols) {
          this._lines.get(i).push(ch);
        }
      }
    }

    // Resize rows in both directions as needed
    let addToY = 0;
    if (this._terminal.rows < newRows) {
      for (let y = this._terminal.rows; y < newRows; y++) {
        if (this._lines.length < newRows + this.ybase) {
          if (this.ybase > 0 && this._lines.length <= this.ybase + this.y + addToY + 1) {
            // There is room above the buffer and there are no empty elements below the line,
            // scroll up
            this.ybase--;
            addToY++;
            if (this.ydisp > 0) {
              // Viewport is at the top of the buffer, must increase downwards
              this.ydisp--;
            }
          } else {
            // Add a blank line if there is no buffer left at the top to scroll to, or if there
            // are blank lines after the cursor
            this._lines.push(this._terminal.blankLine());
          }
        }
      }
    } else { // (this._terminal.rows >= newRows)
      for (let y = this._terminal.rows; y > newRows; y--) {
        if (this._lines.length > newRows + this.ybase) {
          if (this._lines.length > this.ybase + this.y + 1) {
            // The line is a blank line below the cursor, remove it
            this._lines.pop();
          } else {
            // The line is the cursor, scroll down
            this.ybase++;
            this.ydisp++;
          }
        }
      }
    }

    // Make sure that the cursor stays on screen
    if (this.y >= newRows) {
      this.y = newRows - 1;
    }
    if (addToY) {
      this.y += addToY;
    }

    if (this.x >= newCols) {
      this.x = newCols - 1;
    }

    this.scrollTop = 0;
    this.scrollBottom = newRows - 1;
  }
}
