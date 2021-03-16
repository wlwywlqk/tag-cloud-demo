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

export interface TagData extends Tag {
  angle: number;
  fontSize: number;
  x: number;
  y: number;
}

const ZERO_STR = "00000000000000000000000000000000";

export class TagCloud {
  private readonly defaultOptions: Options = {
    width: 200,
    height: 200,
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
    family: "sans-serif"
  };
  options: Options;
  private $container: HTMLElement;
  private $canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private $offsetscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  private pixels: number[][] = [];

  private maxTagWeight = 0;
  private minTagWeight = Infinity;

  private promised: Promise<void> = Promise.resolve();
  constructor($container: HTMLElement, options?: Partial<Options>) {
    this.$container = $container;
    this.options = { ...this.defaultOptions, ...options };

    const { width, height, maskImage, pixelRatio } = this.options;

    this.$canvas = document.createElement("canvas");
    this.$canvas.width = width;
    this.$canvas.height = height;
    this.ctx = this.$canvas.getContext("2d")!;

    this.$offsetscreenCanvas = document.createElement("canvas");
    this.$offsetscreenCanvas.width = width;
    this.$offsetscreenCanvas.height = height;
    this.offscreenCtx = this.$offsetscreenCanvas.getContext("2d")!;

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
        $img.onload = async () => {
          await this.loadMaskImage($img);
          resolve();
        };
        $img.onerror = reject;
      });
      $img.crossOrigin = "anonymous";
      $img.src = maskImage;
    }
    this.$container.append(this.$canvas);
  }

  public destory() {
    if (this.$container) {
      this.$container.removeChild(this.$canvas);
    }
  }

  public async draw(tags: Tag[] = []): Promise<TagData[]> {
    if (tags.length === 0) return [];
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
    return result;
  }

  private async handleTag(tag: Tag): Promise<TagData> {
    const { minTagWeight, maxTagWeight } = this;
    const {
      minFontSize,
      maxFontSize,
      angleCount,
      angleFrom,
      angleTo
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
          (((0xffffff * Math.random()) >> 0) + 0x1000000).toString(16).slice(1)
        : maybeColor;

    await this.getTagPixels({ text, angle, fontSize, color });

    return {
      text,
      weight,
      fontSize,
      angle
    };
  }

  private async getTagPixels({
    text,
    angle,
    fontSize,
    color
  }: {
    text: string;
    angle: number;
    fontSize: number;
    color: string;
  }): Promise<void> {
    this.ctx.save();
    const theta = (angle * Math.PI) / 180;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    // this.ctx.rotate(theta);
    this.ctx.font = `${fontSize}px ${this.options.family}`;
    const {
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent
    }: TextMetrics = this.ctx.measureText(text);
    const width = actualBoundingBoxLeft + actualBoundingBoxRight;
    const height = actualBoundingBoxAscent + actualBoundingBoxDescent;

    const len = height * cosTheta;
    const x = len * sinTheta;
    const y = len * cosTheta;

    // const pixelWidth = 100;
    // const pixelHeight = 100;
    // this.ctx.rect(0, 0, pixelWidth, pixelHeight);
    this.ctx.textAlign = "center";
    this.ctx.translate(width / 2, height / 2)
    this.ctx.rotate(theta);
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, 0, 0);
    this.ctx.rect(0, -height, width, height);

    

    this.ctx.stroke();
    this.ctx.restore();
  }

  public getCtx() {
    return this.offscreenCtx;
  }

  private async loadMaskImage($maskImage: HTMLImageElement) {
    const {
      width,
      height,
      opacityThreshold,
      lightThreshold,
      pixelRatio,
      debug
    } = this.options;
    if (debug) console.time("loadMaskImage");
    this.offscreenCtx.drawImage($maskImage, 0, 0, width, height);
    const imgData = this.offscreenCtx.getImageData(0, 0, width, width);
    const data = imgData.data;
    const dataXLength = width << 2;
    const dataYLength = height << 2;

    const pixelXLength = Math.ceil(width / pixelRatio);
    const pixelYLength = Math.ceil(height / pixelRatio);
    let pixelCount = pixelXLength * pixelYLength;

    let pixelX = 0;
    let pixelY = 0;

    const edgeXLength = dataXLength % pixelRatio || pixelRatio;
    const edgeYLength = dataYLength % pixelRatio || pixelRatio;
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

          this.pixels[pixelY][xIndex] &= ~(1 << -(pixelX + 1));

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

    if (debug) console.timeEnd("loadMaskImage");
    // this.printPixels(this.pixels);
  }
  private printPixels(pixels: number[][]): void {
    for (let i = 0, len = this.pixels.length; i < len; i++) {
      console.log(pixels[i].map(this.binaryIfy).join("") + "_" + i);
    }
  }
  private binaryIfy(num: number): string {
    if (num >= 0) {
      const numStr = num.toString(2);
      return ZERO_STR.slice(0, 32 - numStr.length) + numStr;
    }
    return (Math.pow(2, 32) + num).toString(2);
  }
}