import { TagCloud } from "./tagCloud";
import MASK from "./panda.png";
const $container: HTMLElement = document.querySelector("#app")!;

const tagCloud = new TagCloud($container, {
  width: 500,
  height: 500,
  maskImage: MASK,
  debug: true,
  minFontSize: 20,
  maxFontSize: 40,
  angleCount: 30,
  angleFrom: 240,
  angleTo: 90
});

tagCloud.draw([
  // { text: "aaaaalgaaa", weight: 100, color: "red" },
  // { text: "llllllll", weight: 100, color: "blue" },
  // { text: "ab", weight: 110 },
  // { text: "ac", weight: 90 },
  // { text: "ad", weight: 10 },
  // { text: "aaa", weight: 10 },
  // { text: "afds", weight: 10 },
  // { text: "agdfgdfg", weight: 10 },
  // { text: "awerwer", weight: 50 },
  // { text: "aflf", weight: 10 },
  // { text: "afsoufsaf", weight: 10 },
  // { text: "adfgdsg", weight: 10 },
  // { text: "asf", weight: 10 },
  // { text: "xsdfa", weight: 20 },
  // { text: "adf", weight: 10 },
  // { text: "dgdfga", weight: 10 },
  { text: "a", weight: 10 },
  // { text: "adfa", weight: 10 },
  // { text: "asdffg", weight: 10 }
]);
