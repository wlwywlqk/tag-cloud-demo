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
  cut: boolean,
  padding: number;
}

export interface Tag {
  text: string;
  weight: number;
  angle?: number;
  color?: string;
}

export interface Pixels {
  width: number;
  height: number;
  data: number[][];
}

export interface TagData extends Tag {
  angle: number;
  fontSize: number;
  x: number;
  y: number;
  rendered: boolean;
}

const ZERO_STR = "00000000000000000000000000000000";

export class TagCloud {
  private readonly defaultOptions: Options = {
    width: 500,
    height: 500,
    maskImage: false,
    debug: false,
    pixelRatio: 4,
    lightThreshold: ((255 * 3) / 2) >> 0,
    opacityThreshold: 255,
    minFontSize: 10,
    maxFontSize: 100,
    angleFrom: -60,
    angleTo: 60,
    angleCount: 3,
    family: "sans-serif",
    cut: true,
    padding: 10,
  };
  options: Options;
  private $container: HTMLElement;
  private $canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private $offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  private pixels: Pixels = {
    width: 0, height: 0, data: []
  };

  private maxTagWeight = 0;
  private minTagWeight = Infinity;

  private promised: Promise<void> = Promise.resolve();
  constructor($container: HTMLElement, options?: Partial<Options>) {
    this.$container = $container;
    this.options = { ...this.defaultOptions, ...options };

    this.options.pixelRatio = Math.round(Math.max(this.options.pixelRatio, 1));

    const { width, height, maskImage } = this.options;

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
      this.pixels = this.generatePixels(width, height, 0, false);
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
      console.time(`tag_${sortTags[i].text}`);
      const tagData = this.handleTag(sortTags[i]);
      console.timeEnd(`tag_${sortTags[i].text}`);
      result.push(tagData);
    }
    if (this.options.debug) console.timeEnd('draw');

    return result;
  }

  public shape(cb: (ctx: CanvasRenderingContext2D) => void) {
    const {
      width,
      height,
      debug,
    } = this.options;
    this.offscreenCtx.clearRect(0, 0, width, height);
    cb(this.offscreenCtx);
    const imgData = this.offscreenCtx.getImageData(0, 0, width, width);
    this.pixels = this.getPixelsFromImgData(
      imgData,
      2,
      255 * 3,
      -1,
      false
    );
  }

  private generatePixels(
    width: number,
    height: number,
    fill: -1 | 0 = 0,
    forTag: boolean = true,
  ): Pixels {
    const { pixelRatio, cut } = this.options;
    const pixelXLength = Math.ceil(width / pixelRatio);
    const pixelYLength = Math.ceil(height / pixelRatio);
    const data = [];

    const len = Math.ceil(pixelXLength / 32);
    const tailOffset = pixelXLength % 32;
    const tailFill = (forTag || tailOffset === 0) ? fill : cut ? fill & (-1 << 32 - tailOffset) : fill | (-1 >>> tailOffset);

    for (let i = 0; i < pixelYLength; i++) {
      const xData = new Array(len).fill(fill);
      xData[len - 1] = tailFill;
      data.push(xData);
    }
    return {
      width,
      height,
      data
    };
  }

  private handleTag(tag: Tag): TagData {
    const { minTagWeight, maxTagWeight } = this;
    const {
      minFontSize,
      maxFontSize,
      angleCount,
      angleFrom,
      angleTo,
      padding
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
        ? (angleCount === 1) ? angleFrom : (angleFrom + (randomNum / (angleCount - 1)) * (angleTo - angleFrom))
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
      color,
      padding,
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
    if (x !== -1 && y !== -1) {
      this.ctx.save();
      const theta = (-angle * Math.PI) / 180;
      this.ctx.font = `${fontSize}px ${this.options.family}`;
      const {
        actualBoundingBoxLeft,
        actualBoundingBoxRight,
        actualBoundingBoxAscent,
        actualBoundingBoxDescent
      }: TextMetrics = this.ctx.measureText(text);
      const width = actualBoundingBoxLeft + actualBoundingBoxRight;
      const height = actualBoundingBoxAscent + actualBoundingBoxDescent;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      this.ctx.font = `${fontSize}px ${this.options.family}`;

      const widthWithPadding = width + padding;
      const heightWithPadding = height + padding;

      const pixelWidth =
        (Math.abs(heightWithPadding * sinTheta) + Math.abs(widthWithPadding * cosTheta)) >> 0;
      const pixelHeight =
        (Math.abs(heightWithPadding * cosTheta) + Math.abs(widthWithPadding * sinTheta)) >> 0;

      this.ctx.translate(x + pixelWidth / 2, y + pixelHeight / 2);
      this.ctx.rotate(theta);
      this.ctx.fillStyle = color;

      this.ctx.fillText(
        text,
        actualBoundingBoxLeft - width / 2,
        height / 2 - actualBoundingBoxDescent
      );

      this.ctx.restore();
    }

    return result;
  }

  private placeTag(pixels: Pixels): [number, number] {
    const { width, height, pixelRatio } = this.options;

    // const startX = Math.random() * width >> 0;
    // const startY = Math.random() * height >> 0;

    const startX = (width - pixels.width) / 2 >> 0;
    const startY = (height - pixels.height) / 2 >> 0;

    const endLen = Math.max(startX, width - startX, startY, height - startY) / pixelRatio + 1 >> 0;

    let x = startX;
    let y = startY;

    if (this.tryPlaceTag(pixels, x, y)) {
      return [x, y]
    }

    let step = 1;

    let xDir = Math.random() < 0.5 ? 1 : -1;
    let yDir = Math.random() < 0.5 ? 1 : -1;
    const { width: pixelsWidth, height: pixelsHeight } = pixels;
    while ((step >> 1) < endLen) {
      let rest = step;
      if (y < -pixelsHeight || y > height) {
        x += xDir * pixelRatio * rest;
      } else while (rest--) {
        x += xDir * pixelRatio;
        if (x < -pixelsWidth || x > width) continue;
        if (this.tryPlaceTag(pixels, x, y)) {
          return [x, y];
        }
      }

      xDir = -xDir;
      rest = step;

      if (x < -pixelsWidth || x > width) {
        y += yDir * pixelRatio * rest;
      } else while (rest--) {
        y += yDir * pixelRatio;
        if (y < -pixelsHeight || y > height) continue;

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
    const { pixelRatio, cut } = this.options;
    const { width, height, data } = pixels;
    const { data: thisData } = this.pixels;
    const pixelsX = Math.floor(x / pixelRatio);
    const pixelsY = Math.floor(y / pixelRatio);
    const offset = pixelsX % 32;
    const fix = offset ? -1 : 0;
    const xx = Math.floor(pixelsX / 32);
    const out = cut ? 0 : -1;
    for (let i = 0, len = data.length; i < len; i++) {
      const yData = thisData[pixelsY + i] === undefined ? [] : thisData[pixelsY + i];
      for (let j = 0, len = data[i].length; j < len; j++) {
        const current = yData[xx + j] === undefined ? out : yData[xx + j];
        const next = (yData[xx + j + 1] === undefined ? out : yData[xx + j + 1]) & fix;
        if ((current << offset | next >>> 32 - offset) & data[i][j]) {
          return false
        }
      }
    }

    for (let i = 0, len = data.length; i < len; i++) {
      const yData = thisData[pixelsY + i] === undefined ? [] : thisData[pixelsY + i];
      for (let j = 0, len = data[i].length; j < len; j++) {
        const target = data[i][j];
        if (yData[xx + j] !== undefined) {
          yData[xx + j] |= target >>> offset;
        }
        if (yData[xx + j + 1] !== undefined && offset) {
          yData[xx + j + 1] |= target << 32 - offset;
        }
      }
    }
    return true;
  }

  private getTagPixels({
    text,
    angle,
    fontSize,
    color,
    padding
  }: {
    text: string;
    angle: number;
    fontSize: number;
    color: string;
    padding: number;
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

    const widthWithPadding = width + padding;
    const heightWithPadding = height + padding;

    const pixelWidth =
      (Math.abs(heightWithPadding * sinTheta) + Math.abs(widthWithPadding * cosTheta)) >> 0;
    const pixelHeight =
      (Math.abs(heightWithPadding * cosTheta) + Math.abs(widthWithPadding * sinTheta)) >> 0;

    if (pixelHeight > this.options.height || pixelWidth > this.options.width) {
      return null;
    }
    this.offscreenCtx.clearRect(0, 0, pixelWidth, pixelHeight);

    // this.offscreenCtx.rect(0, 0, pixelWidth, pixelHeight);
    // this.offscreenCtx.stroke();


    this.offscreenCtx.translate(pixelWidth / 2, pixelHeight / 2);
    this.offscreenCtx.rotate(theta);
    this.offscreenCtx.fillStyle = color;
    this.offscreenCtx.lineWidth = padding;

    // this.offscreenCtx.rect(-width / 2, -height / 2, width, height);
    // this.offscreenCtx.stroke();
    this.offscreenCtx.strokeText(
      text,
      actualBoundingBoxLeft - width / 2,
      height / 2 - actualBoundingBoxDescent
    );
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
    fill: 0 | -1 = 0,
    forTag: boolean = true
  ): Pixels {
    const { pixelRatio, debug, cut } = this.options;
    const { data, width, height } = imgData;
    const pixels = this.generatePixels(width, height, fill, forTag);
    const { data: pixelsData } = pixels;

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
            pixelsData[pixelY][xIndex] &= ~(1 << -(pixelX + 1));
          } else {
            pixelsData[pixelY][xIndex] |= 1 << -(pixelX + 1);
          }

          if (debug) {
            this.ctx.fillStyle = "rgba(0,0,255,0.1)";
            this.ctx.fillRect(
              pixelX * pixelRatio + .2,
              pixelY * pixelRatio + .2,
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
    return {
      width,
      height,
      data: pixelsData
    };
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
      -1,
      false
    );

    if (debug) console.timeEnd("loadMaskImage");
    return pixels;
  }
  private printPixels(pixels: Pixels | null): void {
    if (pixels === null) return;
    for (let i = 0, len = pixels.data.length; i < len; i++) {
      console.log(pixels.data[i].map(this.binaryStrIfy).join("") + "_" + i);
    }
  }
  private binaryStrIfy(num: number): string {
    if (num >= 0) {
      const numStr = num.toString(2);
      return (ZERO_STR.slice(0, 32 - numStr.length) + numStr);
    }
    return (Math.pow(2, 32) + num).toString(2);
  }
}
