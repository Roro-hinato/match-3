import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

const PADDING = 16;
const BUTTON_W = 90;
const BUTTON_H = 36;
const SOUND_BUTTON_W = 110;
const HUD_H = 72;

/** Bottom HUD: menu button (left), score (center-left), sound toggle (right). */
export class Hud extends Container {
  private scoreText: Text;
  private menuBtn: Container;
  private menuBg: Graphics;
  private menuLabel: Text;
  private menuHovered = false;
  private onMenuClick?: () => void;

  private soundBg: Graphics;
  private soundLabel: Text;
  private soundEnabled = true;
  private soundHovered = false;
  private onSoundToggle?: () => void;

  constructor(width: number) {
    super();

    // --- Menu button (left) ---
    this.menuBtn = new Container();
    this.menuBtn.x = PADDING;
    this.menuBtn.y = (HUD_H - BUTTON_H) / 2;
    this.menuBg = new Graphics();
    this.menuBtn.addChild(this.menuBg);
    const menuStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 15,
      fill: 0xffffff,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    this.menuLabel = new Text({ text: '← MENU', style: menuStyle });
    this.menuLabel.anchor.set(0.5);
    this.menuLabel.x = BUTTON_W / 2;
    this.menuLabel.y = BUTTON_H / 2;
    this.menuBtn.addChild(this.menuLabel);
    this.menuBtn.eventMode = 'static';
    this.menuBtn.cursor = 'pointer';
    this.menuBtn.on('pointerover', () => {
      this.menuHovered = true;
      this.renderMenu();
    });
    this.menuBtn.on('pointerout', () => {
      this.menuHovered = false;
      this.renderMenu();
    });
    this.menuBtn.on('pointerdown', () => this.onMenuClick?.());
    this.menuBtn.visible = false;
    this.addChild(this.menuBtn);
    this.renderMenu();

    // --- Score ---
    const scoreStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 26,
      fill: 0xffffff,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    this.scoreText = new Text({ text: 'Score: 0', style: scoreStyle });
    this.scoreText.anchor.set(0, 0.5);
    this.scoreText.x = PADDING + BUTTON_W + 20;
    this.scoreText.y = HUD_H / 2;
    this.addChild(this.scoreText);

    // --- Sound button (right) ---
    const soundBtn = new Container();
    soundBtn.x = width - PADDING - SOUND_BUTTON_W;
    soundBtn.y = (HUD_H - BUTTON_H) / 2;
    this.soundBg = new Graphics();
    soundBtn.addChild(this.soundBg);
    const soundStyle = new TextStyle({
      fontFamily: 'system-ui, Arial, sans-serif',
      fontSize: 17,
      fill: 0xffffff,
      fontWeight: 'bold',
      letterSpacing: 1,
    });
    this.soundLabel = new Text({ text: 'SON ON', style: soundStyle });
    this.soundLabel.anchor.set(0.5);
    this.soundLabel.x = SOUND_BUTTON_W / 2;
    this.soundLabel.y = BUTTON_H / 2;
    soundBtn.addChild(this.soundLabel);
    soundBtn.eventMode = 'static';
    soundBtn.cursor = 'pointer';
    soundBtn.on('pointerover', () => {
      this.soundHovered = true;
      this.renderSound();
    });
    soundBtn.on('pointerout', () => {
      this.soundHovered = false;
      this.renderSound();
    });
    soundBtn.on('pointerdown', () => this.onSoundToggle?.());
    this.addChild(soundBtn);
    this.renderSound();
  }

  setMenuVisible(v: boolean): void {
    this.menuBtn.visible = v;
    this.scoreText.x = v ? PADDING + BUTTON_W + 20 : PADDING;
  }

  setOnMenuClick(cb: () => void): void {
    this.onMenuClick = cb;
  }

  setOnToggle(cb: () => void): void {
    this.onSoundToggle = cb;
  }

  setScore(n: number): void {
    this.scoreText.text = `Score: ${n}`;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.renderSound();
  }

  getScoreStagePosition(): { x: number; y: number } {
    const b = this.scoreText.getBounds();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  pulseScore(): void {
    gsap.killTweensOf(this.scoreText.scale);
    gsap.to(this.scoreText.scale, {
      x: 1.3,
      y: 1.3,
      duration: 0.08,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(this.scoreText.scale, {
          x: 1,
          y: 1,
          duration: 0.18,
          ease: 'power2.out',
        });
      },
    });
  }

  private renderMenu(): void {
    const c = this.menuHovered ? 0x55555f : 0x3a3a45;
    this.menuBg.clear();
    this.menuBg.roundRect(0, 0, BUTTON_W, BUTTON_H, 8).fill(c);
  }

  private renderSound(): void {
    const bg = this.soundEnabled
      ? this.soundHovered
        ? 0x3edc81
        : 0x2ed573
      : this.soundHovered
        ? 0x55555f
        : 0x3a3a45;
    this.soundBg.clear();
    this.soundBg.roundRect(0, 0, SOUND_BUTTON_W, BUTTON_H, 8).fill(bg);
    this.soundLabel.text = this.soundEnabled ? 'SON ON' : 'SON OFF';
  }
}
