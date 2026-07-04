import { Component, OnInit, Input, Output, EventEmitter, ElementRef, ViewChild, HostListener } from '@angular/core';

interface Point {
  id: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-pattern-lock',
  template: `
    <div class="pattern-lock-container">
      <div class="sr-only" aria-live="polite">
        Security Pattern Grid. Swipe to connect, or type numbers 1 to 9 on your keyboard to configure. Current connected path: {{ getPatternString() }}
      </div>
      
      <!-- Responsive SVG Grid Matrix -->
      <svg 
        #svgEl 
        class="pattern-svg"
        viewBox="0 0 300 300"
        (mousedown)="onStart($event)"
        (touchstart)="onStart($event)"
        (mousemove)="onDrag($event)"
        (touchmove)="onDrag($event)"
        (mouseup)="onEnd()"
        (touchend)="onEnd()"
      >
        <!-- Connector Lines -->
        <line 
          *ngFor="let line of getConnectorLines()" 
          [attr.x1]="line.x1" 
          [attr.y1]="line.y1" 
          [attr.x2]="line.x2" 
          [attr.y2]="line.y2" 
          class="connector-line"
        />
        
        <!-- Live Dragging Line -->
        <line 
          *ngIf="isDragging && activePath.length > 0 && dragPoint"
          [attr.x1]="getPointCoords(activePath[activePath.length - 1]).x"
          [attr.y1]="getPointCoords(activePath[activePath.length - 1]).y"
          [attr.x2]="dragPoint?.x"
          [attr.y2]="dragPoint?.y"
          class="dragging-line"
        />

        <!-- Node Circles (WCAG: At least 52px touch area sizing) -->
        <g *ngFor="let node of nodes">
          <circle 
            [attr.cx]="node.x" 
            [attr.cy]="node.y" 
            r="32" 
            class="touch-target-circle"
            (mouseenter)="onNodeHover(node.id)"
            (touchstart)="onNodeTouch(node.id)"
          />
          <circle 
            [attr.cx]="node.x" 
            [attr.cy]="node.y" 
            [attr.r]="isNodeActive(node.id) ? 14 : 10" 
            [class.active-node]="isNodeActive(node.id)"
            class="visual-circle"
          />
          <text 
            [attr.x]="node.x" 
            [attr.y]="node.y + 4" 
            class="node-text"
            text-anchor="middle"
          >
            {{ node.id }}
          </text>
        </g>
      </svg>

      <!-- Keyboard alternative controls -->
      <div class="keyboard-controls">
        <label for="keyboard-input">Keyboard entry (1-9):</label>
        <input 
          id="keyboard-input" 
          type="text" 
          class="input-accessible" 
          placeholder="e.g. 1475" 
          (input)="onKeyboardInput($event)"
          [value]="getPatternString()"
          aria-label="Enter pattern sequence as digits 1 to 9"
        />
        <button 
          type="button" 
          class="btn-accessible btn-secondary" 
          (click)="clearPattern()"
          aria-label="Clear active pattern input"
        >
          Clear Grid
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pattern-lock-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
    }
    .pattern-svg {
      width: 100%;
      aspect-ratio: 1 / 1;
      background: rgba(18, 22, 32, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }
    .touch-target-circle {
      fill: transparent;
      cursor: pointer;
    }
    .visual-circle {
      fill: rgba(255, 255, 255, 0.15);
      stroke: rgba(255, 255, 255, 0.3);
      stroke-width: 2;
      transition: fill 0.2s, stroke 0.2s, r 0.2s;
    }
    .visual-circle.active-node {
      fill: var(--primary);
      stroke: var(--primary-glow);
      filter: drop-shadow(0 0 4px var(--primary));
    }
    .connector-line {
      stroke: var(--primary);
      stroke-width: 6;
      stroke-linecap: round;
      opacity: 0.85;
    }
    .dragging-line {
      stroke: var(--primary);
      stroke-width: 4;
      stroke-dasharray: 4, 4;
      opacity: 0.65;
    }
    .node-text {
      fill: var(--text-muted);
      font-size: 10px;
      font-family: var(--font-display);
      font-weight: bold;
      pointer-events: none;
      user-select: none;
    }
    .keyboard-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .keyboard-controls label {
      font-size: 12px;
      color: var(--text-secondary);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
  `]
})
export class PatternLockComponent implements OnInit {
  @Input() resetOnEnd = true;
  @Output() onPatternComplete = new EventEmitter<string>();

  @ViewChild('svgEl', { static: true }) svgEl!: ElementRef<SVGElement>;

  public nodes: Point[] = [];
  public activePath: number[] = [];
  public isDragging = false;
  public dragPoint: { x: number; y: number } | null = null;

  ngOnInit() {
    this.initGrid();
  }

  private initGrid() {
    // Generate 3x3 point locations
    const padding = 50;
    const spacing = 100;
    let id = 1;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.nodes.push({
          id: id++,
          x: padding + c * spacing,
          y: padding + r * spacing
        });
      }
    }
  }

  public getPointCoords(id: number): Point {
    return this.nodes.find(n => n.id === id) || { id: 0, x: 0, y: 0 };
  }

  public isNodeActive(id: number): boolean {
    return this.activePath.includes(id);
  }

  public getPatternString(): string {
    return this.activePath.join('');
  }

  public getConnectorLines() {
    const lines = [];
    for (let i = 0; i < this.activePath.length - 1; i++) {
      const p1 = this.getPointCoords(this.activePath[i]);
      const p2 = this.getPointCoords(this.activePath[i + 1]);
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return lines;
  }

  // Swipe handlers
  public onStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.isDragging = true;
    this.activePath = [];
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    this.updateDragPoint(clientX, clientY);
    
    // Check if initial click lands on a node
    const nearestNode = this.findNearestNode(clientX, clientY);
    if (nearestNode) {
      this.activePath.push(nearestNode.id);
    }
  }

  public onDrag(event: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;
    event.preventDefault();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    this.updateDragPoint(clientX, clientY);

    const nearestNode = this.findNearestNode(clientX, clientY);
    if (nearestNode && !this.activePath.includes(nearestNode.id)) {
      this.activePath.push(nearestNode.id);
    }
  }

  public onEnd() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragPoint = null;

    if (this.activePath.length > 0) {
      const result = this.getPatternString();
      this.onPatternComplete.emit(result);
      if (this.resetOnEnd) {
        this.clearPattern();
      }
    }
  }

  public onNodeHover(id: number) {
    if (this.isDragging && !this.activePath.includes(id)) {
      this.activePath.push(id);
    }
  }

  public onNodeTouch(id: number) {
    if (this.isDragging && !this.activePath.includes(id)) {
      this.activePath.push(id);
    }
  }

  public clearPattern() {
    this.activePath = [];
    this.dragPoint = null;
  }

  // Keyboard accessibility translation: users can enter numbers 1 to 9
  public onKeyboardInput(event: Event) {
    const inputEl = event.target as HTMLInputElement;
    const val = inputEl.value.replace(/[^1-9]/g, '');
    inputEl.value = val;

    this.activePath = val.split('').map(d => parseInt(d));
    if (this.activePath.length >= 2) {
      this.onPatternComplete.emit(val);
    }
  }

  @HostListener('document:mouseup')
  public onDocMouseUp() {
    this.onEnd();
  }

  private updateDragPoint(clientX: number, clientY: number) {
    const svgRect = this.svgEl.nativeElement.getBoundingClientRect();
    this.dragPoint = {
      x: ((clientX - svgRect.left) / svgRect.width) * 300,
      y: ((clientY - svgRect.top) / svgRect.height) * 300
    };
  }

  private findNearestNode(clientX: number, clientY: number): Point | null {
    const svgRect = this.svgEl.nativeElement.getBoundingClientRect();
    const x = ((clientX - svgRect.left) / svgRect.width) * 300;
    const y = ((clientY - svgRect.top) / svgRect.height) * 300;

    for (const node of this.nodes) {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      if (dist < 24) { // Node snapping threshold radius
        return node;
      }
    }
    return null;
  }
}
