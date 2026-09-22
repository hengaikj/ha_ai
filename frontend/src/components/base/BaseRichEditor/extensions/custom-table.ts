import type { CommandProps } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";

export const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (element) =>
          element.getAttribute("data-width") ||
          element.getAttribute("width") ||
          element.style.width ||
          "100%",
        renderHTML: (attributes) => {
          const width = attributes.width || "100%";
          return {
            "data-width": width,
            style: `width: ${width}; max-width: 100%; margin-left: auto; margin-right: auto;`,
          };
        },
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setTableWidth:
        (width: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { $from } = state.selection;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            if (node.type.name === "table") {
              const pos = $from.before(d);
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  width,
                });
              }
              return true;
            }
          }
          return false;
        },
    };
  },
});
