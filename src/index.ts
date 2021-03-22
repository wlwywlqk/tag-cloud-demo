import { TagCloud, TagData } from "./tagCloud";
import MASK from "./panda.png";
const $container = document.querySelector("#app")! as HTMLElement;

const tagCloud = new TagCloud($container, {
  width: 500,
  height: 500,
  // maskImage: MASK,
  minFontSize: 14,
  maxFontSize: 77,
  angleCount: 3,
  angleFrom: -60,
  angleTo: 60,
  padding: 2,
  canvas: false,
  family: "Tahoma",
});

tagCloud.shape((ctx: CanvasRenderingContext2D) => {
  ctx.arc(250, 250, 200, 0, Math.PI * 2);
  ctx.fill();
});

tagCloud.click((tag: TagData) => {
  console.log(tag);
});

tagCloud.draw([
  { text: "Web", weight: 100, color: 'red' },
  { text: "Node.js", weight: 100, color: 'rgba(0,0,0,1)', angle: 90 },
  { text: "HTML", weight: 100 },
  { text: "Css", weight: 100 },
  { text: "javascript", weight: 100 },
  { text: "JS", weight: 100 },
  { text: "React", weight: 10 },
  { text: "Vue", weight: 10 },
  { text: "AngularJS", weight: 10 },
  { text: "易", weight: 10 },
  { text: "烫烫烫", weight: 10 },
  { text: "NestJs", weight: 10 },
  { text: "C", weight: 20 },
  { text: "Babel", weight: 20 },
  { text: "ast", weight: 20 },
  { text: "webpack", weight: 20 },
  { text: "plugin", weight: 20 },
  { text: "C++", weight: 10 },
  { text: "C#", weight: 10 },
  { text: "Android", weight: 20 },
  { text: "iOS", weight: 20 },
  { text: "null", weight: 20 },
  { text: "canvas", weight: 20 },
  { text: "WebGL", weight: 20 },
  { text: "var", weight: 20 },
  { text: "int", weight: 20 },
  { text: "String", weight: 20 },
  { text: "JSON", weight: 20 },
  { text: "MDN", weight: 20 },
  { text: "API", weight: 20 },
  { text: "Image", weight: 20 },
  { text: "Text", weight: 20 },
  { text: "Set", weight: 20 },
  { text: "extends", weight: 20 },
  { text: "Map", weight: 20 },
  { text: "Map", weight: 20 },
  { text: "WeakMap", weight: 20 },
  { text: "Number", weight: 20 },
  { text: "Promise", weight: 20 },
  { text: "then", weight: 20 },
  { text: "DOM", weight: 20 },
  { text: "new", weight: 20 },
  { text: "throw", weight: 20 },
  { text: "define", weight: 20 },
  { text: "center", weight: 20 },
  { text: "left", weight: 20 },
  { text: "flex", weight: 20 },
  { text: "grid", weight: 20 },
  { text: "inline", weight: 20 },
  { text: "block", weight: 20 },
  { text: "throw", weight: 20 },
  { text: "catch", weight: 20 },
  { text: "www", weight: 20 },
  { text: "localhost", weight: 20 },
  { text: "127.0.0.1", weight: 20 },
  { text: "less", weight: 20 },
  { text: "Sass", weight: 20 },
  { text: "Data", weight: 20 },
  { text: "SVG", weight: 20 },
  { text: "loading...", weight: 20 },
  { text: "const", weight: 10 }
]);