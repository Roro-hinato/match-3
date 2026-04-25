import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export interface ButtonOptions {
  label: string;
  width: number;
  height: number;
  fontSize?: number;
  bgColor?: number;
  hoverColor?: number;
  disabledColor?: number;
  textColor?: number;
  onClick: () => void;
}

/** A rounded rectangular button with hover + click feedback. */
export class Button extends Container {
  private bg: Graphics;
  private labelText: Text;
  private opts: Required<Omit<ButtonOptions, 'onClick'>> & { onClick: () => void };
  private hovered = false;
  private _disabled = false;

  constructor(opts: ButtonOptions) {
    super();
    this.opts = {
      fontSize: 18,
      bgColor: 0x2ed573,
      hoverColor: 0x3edc81,
      disabledColor: 0x3a3a45,
      textColor: 0xffffff,
      ...opts,
    };

    this.bg = new Graphics();
    this.addChild(this.bg);

    const style = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: this.opts.fontSize,
      fill: this.opts.textColor,
      fontWeight: 'bold',
      letterSpacing: 1,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: this.opts.width - 12,
    });
    this.labelText = new Text({ text: this.opts.label, style });
    this.labelText.anchor.set(0.5);
    this.labelText.x = this.opts.width / 2;
    this.labelText.y = this.opts.height / 2;
    this.addChild(this.labelText);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => {
      this.hovered = true;
      this.render();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.render();
    });
    this.on('pointerdown', () => {
      if (!this._disabled) this.opts.onClick();
    });

    this.render();
  }

  setDisabled(disabled: boolean): void {
    this._disabled = disabled;
    this.eventMode = disabled ? 'none' : 'static';
    this.cursor = disabled ? 'default' : 'pointer';
    this.render();
  }

  setLabel(label: string): void {
    this.labelText.text = label;
  }

  private render(): void {
    const bg = this._disabled
      ? this.opts.disabledColor
      : this.hovered
        ? this.opts.hoverColor
        : this.opts.bgColor;
    this.bg.clear();
    this.bg.roundRect(0, 0, this.opts.width, this.opts.height, 10).fill(bg);
    this.labelText.style.fill = this._disabled ? 0x707080 : this.opts.textColor;
  }
}
