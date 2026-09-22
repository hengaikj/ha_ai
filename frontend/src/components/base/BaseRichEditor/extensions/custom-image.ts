import Image from "@tiptap/extension-image";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import ImageNodeView from "../components/ImageNodeView.vue";

export interface CustomImageOptions {
  inline?: boolean;
  allowBase64?: boolean;
  HTMLAttributes?: Record<string, unknown>;
}

export const CustomImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-attachment-id") ??
          element.getAttribute("attachmentId") ??
          element.getAttribute("attachmentid") ??
          element.getAttribute("id"),
        renderHTML: (attributes) => {
          if (!attributes.attachmentId) return {};
          return {
            "data-attachment-id": String(attributes.attachmentId),
            attachmentId: String(attributes.attachmentId),
            id: String(attributes.attachmentId),
          };
        },
      },
      width: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("width") ||
          element.getAttribute("data-width") ||
          element.style.width ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return {
            width: attributes.width,
            "data-width": attributes.width,
          };
        },
      },
      align: {
        default: "center",
        parseHTML: (element) => {
          const dataAlign = element.getAttribute("data-align");
          if (dataAlign) return dataAlign;
          const align = element.getAttribute("align");
          if (align) return align;
          if (element.style.marginLeft === "0px" || element.style.float === "left") {
            return "left";
          }
          if (element.style.marginRight === "0px" || element.style.float === "right") {
            return "right";
          }
          return "center";
        },
        renderHTML: (attributes) => {
          const align = attributes.align || "center";
          return {
            align,
            "data-align": align,
          };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = node.attrs.width;
    const align = node.attrs.align || "center";

    let style = "max-width: 100%;";
    if (width) {
      style += ` width: ${width};`;
    }

    if (align === "left") {
      style += " display: block; margin-left: 0; margin-right: auto;";
    } else if (align === "right") {
      style += " display: block; margin-left: auto; margin-right: 0;";
    } else {
      style += " display: block; margin-left: auto; margin-right: auto;";
    }

    const mergedStyle = HTMLAttributes.style
      ? `${HTMLAttributes.style}; ${style}`
      : style;

    return [
      "img",
      {
        ...HTMLAttributes,
        style: mergedStyle,
      },
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageNodeView);
  },
});

