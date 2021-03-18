export interface Options {
  width: number;
  height: number;
  maskImage: string | false | null | undefined;
  debug: boolean;
  pixelRatio: number;
  lightThreshold: number;
  opacityThreshold: number;
  minFontSize: number;
  maxFontSize: number;
  angleFrom: number;
  angleTo: number;
  angleCount: number;
  family: string;
}

export interface Tag {
  text: string;
  weight: number;
  angle?: number;
  color?: string;
}

export type Pixels = number[][];

export interface TagData extends Tag {
  angle: number;
  fontSize: number;
  x: number;
  y: number;
  rendered: boolean;
}

const ZERO_STR = "00000000000000000000000000000000";
const SQRT_2 = Math.sqrt(2);

export class TagCloud {
  private readonly defaultOptions: Options = {
    width: 200,
    height: 200,
    maskImage: false,
    debug: false,
    pixelRatio: 8,
    lightThreshold: ((255 * 3) / 2) >> 0,
    opacityThreshold: 255,
    minFontSize: 10,
    maxFontSize: 100,
    angleFrom: -60,
    angleTo: 60,
    angleCount: 3,
    family: "sans-serif"
  };
  options: Options;
  private $container: HTMLElement;
  private $canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private $offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  private pixels: Pixels = [];

  private maxTagWeight = 0;
  private minTagWeight = Infinity;

  private promised: Promise<void> = Promise.resolve();
  constructor($container: HTMLElement, options?: Partial<Options>) {
    this.$container = $container;
    this.options = { ...this.defaultOptions, ...options };

    this.options.pixelRatio = Math.round(Math.max(this.options.pixelRatio, 1));

    const { width, height, maskImage, pixelRatio } = this.options;

    this.$canvas = document.createElement("canvas");
    this.$canvas.width = width;
    this.$canvas.height = height;
    this.ctx = this.$canvas.getContext("2d")!;
    this.ctx.textAlign = 'center';

    this.$offscreenCanvas = document.createElement("canvas");
    this.$offscreenCanvas.width = width;
    this.$offscreenCanvas.height = height;
    this.offscreenCtx = this.$offscreenCanvas.getContext("2d")!;
    this.offscreenCtx.textAlign = 'center';

    const pixelXLength = Math.ceil(width / pixelRatio);
    const pixelYLength = Math.ceil(height / pixelRatio);

    const willFill = maskImage ? -1 : 0;
    const pixelLength = Math.ceil(pixelXLength / 32);
    for (let i = 0; i < pixelYLength; i++) {
      this.pixels.push(new Array(pixelLength).fill(willFill));
    }

    if (maskImage) {
      const $img: HTMLImageElement = new Image();
      this.promised = new Promise((resolve, reject) => {
        $img.onload = () => {
          this.pixels = this.loadMaskImage($img);
          resolve();
        };
        $img.onerror = reject;
      });
      $img.crossOrigin = "anonymous";
      $img.src = maskImage;
    } else {
      this.pixels = this.generatePixels(width, height);
    }
    this.$container.append(this.$canvas);
    if (this.options.debug) {
      this.$offscreenCanvas.style.border = "1px solid #aaaaaa";
      this.$container.append(this.$offscreenCanvas);
    }
  }

  public destory() {
    if (this.$container) {
      this.$container.removeChild(this.$canvas);
    }
  }

  public async draw(tags: Tag[] = []): Promise<TagData[]> {
    if (tags.length === 0) return [];
    if (this.options.debug) console.time('draw');
    const result: TagData[] = [];
    await this.promised;
    for (let i = 0, len = tags.length; i < len; i++) {
      const { weight } = tags[i];
      if (weight > this.maxTagWeight) {
        this.maxTagWeight = weight;
      }
      if (weight < this.minTagWeight) {
        this.minTagWeight = weight;
      }
    }

    const sortTags = tags.sort((a, b) => b.weight - a.weight);

    for (let i = 0, len = sortTags.length; i < len; i++) {
      const tagData = await this.handleTag(sortTags[i]);
      result.push(tagData);
    }
    if (this.options.debug) console.timeEnd('draw');

    return result;
  }

  private generatePixels(
    width: number,
    height: number,
    fill: -1 | 0 = 0
  ): Pixels {
    const { pixelRatio } = this.options;
    const pixelXLength = Math.ceil(width / pixelRatio);
    const pixelYLength = Math.ceil(height / pixelRatio);
    const pixels = [];

    const len = Math.ceil(pixelXLength / 32);
    for (let i = 0; i < pixelYLength; i++) {
      pixels.push(new Array(len).fill(fill));
    }
    return pixels;
  }

  private handleTag(tag: Tag): TagData {
    const { minTagWeight, maxTagWeight } = this;
    const {
      minFontSize,
      maxFontSize,
      angleCount,
      angleFrom,
      angleTo,
      width,
      height
    } = this.options;
    const { text, weight, angle: maybeAngle, color: maybeColor } = tag;

    const diffWeight = maxTagWeight - minTagWeight;
    const fontSize =
      diffWeight > 0
        ? Math.round(
          minFontSize +
          (maxFontSize - minFontSize) *
          ((weight - minTagWeight) / diffWeight)
        )
        : Math.round((maxFontSize + minFontSize) / 2);

    const randomNum = (Math.random() * angleCount) >> 0;
    const angle =
      maybeAngle === undefined
        ? angleFrom + (randomNum / (angleCount - 1)) * (angleTo - angleFrom)
        : maybeAngle;

    const color =
      maybeColor === undefined
        ? "#" +
        (((0xffff00 * Math.random()) >> 0) + 0x1000000).toString(16).slice(1)
        : maybeColor;

    const pixels: null | Pixels = this.getTagPixels({
      text,
      angle,
      fontSize,
      color
    });

    const result = {
      text,
      weight,
      fontSize,
      angle,
      x: -1,
      y: -1,
      rendered: false
    };
    if (pixels === null) return result;

    // this.printPixels(pixels);

    const [x, y] = this.placeTag(pixels);

    return result;
  }

  private placeTag(pixels: Pixels): [number, number] {
    const { width, height, pixelRatio } = this.options;


    const startX = Math.random() * width >> 0;
    const startY = Math.random() * height >> 0;

    const endLen = Math.max(startX, width - startX, startY, height - startY) / pixelRatio + 1 >> 0;

    let x = startX;
    let y = startY;

    if (this.tryPlaceTag(pixels, x, y)) {
      return [x, y]
    }

    let step = 1;

    let xDir = Math.random() < 0.5 ? 1 :  -1;
    let yDir = Math.random() < 0.5 ? 1 :  -1;

    while ((step >> 1) < endLen) {
      let rest = step;
      if (y < 0 || y > height) {
        x += xDir * pixelRatio * rest;
      } else while (rest--) {
        x += xDir * pixelRatio;
        if (x < 0 || x > width) continue;
        if (this.tryPlaceTag(pixels, x, y)) {
          return [x, y];
        }
      }
      
      xDir = -xDir;
      rest = step;

      if (x < 0 || x > width) {
        y += yDir * pixelRatio * rest;
      } else while (rest--) {
        y += yDir * pixelRatio;
        if (y < 0 || y > height) continue;

        if (this.tryPlaceTag(pixels, x, y)) {
          return [x, y];
        }
      }

      yDir = -yDir;
      step++;
    }
    return [-1, -1];
  }

  private tryPlaceTag(pixels: Pixels, x: number, y: number): boolean {
    const { pixelRatio } = this.options;
    const pixelsX = x / pixelRatio >> 0;
    const pixelsY = y / pixelRatio >> 0;
    const offsetX = pixelsX % 32;
    const xx = pixelsX / 32 >> 0;


    for (let i = 0, len = pixels.length; i < len; i++) {
      for (let j = 0, len = pixels[i].length; j < len; j++) {
        this.pixels[pixelsY + i][xx + j]
      }
    }
    return false;
  }

  private getTagPixels({
    text,
    angle,
    fontSize,
    color
  }: {
    text: string;
    angle: number;
    fontSize: number;
    color: string;
  }): null | Pixels {
    this.offscreenCtx.save();
    const theta = (-angle * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    this.offscreenCtx.font = `${fontSize}px ${this.options.family}`;
    const {
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent
    }: TextMetrics = this.offscreenCtx.measureText(text);
    const width = actualBoundingBoxLeft + actualBoundingBoxRight;
    const height = actualBoundingBoxAscent + actualBoundingBoxDescent;

    const pixelWidth =
      (Math.abs(height * sinTheta) + Math.abs(width * cosTheta)) >> 0;
    const pixelHeight =
      (Math.abs(height * cosTheta) + Math.abs(width * sinTheta)) >> 0;

    if (pixelHeight > this.options.height || pixelWidth > this.options.width) {
      return null;
    }
    this.offscreenCtx.clearRect(0, 0, pixelWidth, pixelHeight);

    // this.offscreenCtx.rect(0, 0, pixelWidth, pixelHeight);
    // this.offscreenCtx.stroke();


    this.offscreenCtx.translate(pixelWidth / 2, pixelHeight / 2);
    this.offscreenCtx.rotate(theta);
    this.offscreenCtx.fillStyle = color;

    // this.offscreenCtx.rect(-width / 2, -height / 2, width, height);
    // this.offscreenCtx.stroke();

    this.offscreenCtx.fillText(
      text,
      actualBoundingBoxLeft - width / 2,
      height / 2 - actualBoundingBoxDescent
    );

    this.offscreenCtx.restore();

    const imgData: ImageData = this.offscreenCtx.getImageData(
      0,
      0,
      pixelWidth,
      pixelHeight
    );

    return this.getPixelsFromImgData(imgData, 2, 255 * 3);
  }
  private getPixelsFromImgData(
    imgData: ImageData,
    opacityThreshold: number,
    lightThreshold: number,
    fill: 0 | -1 = 0
  ): Pixels {
    const { pixelRatio, debug } = this.options;
    const { data, width, height } = imgData;
    const pixels = this.generatePixels(width, height, fill);

    const dataXLength = width << 2;

    const pixelXLength = Math.ceil(width / pixelRatio);
    const pixelYLength = Math.ceil(height / pixelRatio);
    let pixelCount = pixelXLength * pixelYLength;

    let pixelX = 0;
    let pixelY = 0;

    const edgeXLength = width % pixelRatio || pixelRatio;
    const edgeYLength = height % pixelRatio || pixelRatio;
    while (pixelCount--) {
      const outerOffset =
        pixelY * pixelRatio * dataXLength + ((pixelX * pixelRatio) << 2);
      const xLength = pixelX === pixelXLength - 1 ? edgeXLength : pixelRatio;
      const yLength = pixelY === pixelYLength - 1 ? edgeYLength : pixelRatio;
      const xIndex = (pixelX / 32) >> 0;

      let y = 0;
      outer: while (y < yLength) {
        let x = 0;

        const offset = outerOffset + y++ * dataXLength;
        while (x < xLength) {
          const pos = offset + (x++ << 2);
          const opacity = data[pos + 3];
          if (opacity < opacityThreshold) {
            continue;
          }
          const light = data[pos] + data[pos + 1] + data[pos + 2];
          if (light > lightThreshold) {
            continue;
          }

          if (fill) {
            pixels[pixelY][xIndex] &= ~(1 << -(pixelX + 1));
          } else {
            pixels[pixelY][xIndex] |= 1 << -(pixelX + 1);
          }

          if (debug) {
            this.ctx.fillStyle = "rgba(0,0,255,0.1)";
            this.ctx.fillRect(
              pixelX * pixelRatio,
              pixelY * pixelRatio,
              pixelRatio - 0.2,
              pixelRatio - 0.2
            );
          }

          break outer;
        }
      }

      pixelX++;
      if (pixelX === pixelXLength) {
        pixelX = 0;
        pixelY++;
      }
    }
    return pixels;
  }

  public getCtx(): CanvasRenderingContext2D {
    return this.ctx;
  }

  public getOffscreenCtx(): CanvasRenderingContext2D {
    return this.offscreenCtx;
  }

  private loadMaskImage($maskImage: HTMLImageElement): Pixels {
    const {
      width,
      height,
      debug,
      opacityThreshold,
      lightThreshold
    } = this.options;

    if (debug) console.time("loadMaskImage");

    this.offscreenCtx.clearRect(0, 0, width, height);
    this.offscreenCtx.drawImage($maskImage, 0, 0, width, height);
    const imgData = this.offscreenCtx.getImageData(0, 0, width, width);
    const pixels = this.getPixelsFromImgData(
      imgData,
      opacityThreshold,
      lightThreshold,
      -1
    );

    if (debug) console.timeEnd("loadMaskImage");
    return pixels;
  }
  private printPixels(pixels: Pixels | null): void {
    if (pixels === null) return;
    for (let i = 0, len = pixels.length; i < len; i++) {
      console.log(pixels[i].map(this.binaryIfy).join("") + "_" + i);
    }
  }
  private binaryIfy(num: number): string {
    if (num >= 0) {
      const numStr = num.toString(2);
      return (ZERO_STR.slice(0, 32 - numStr.length) + numStr);
    }
    return (Math.pow(2, 32) + num).toString(2);
  }
}
