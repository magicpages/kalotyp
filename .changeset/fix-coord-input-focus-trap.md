---
"@magicpages/kalotyp-ui": patch
"@magicpages/kalotyp": patch
---

Fix an annotate selection glitch where the coordinate inputs (X / Y / Size / Angle) trapped focus. After typing a value and committing with Enter the field kept focus, so a subsequent drag-resize on the canvas left the Size field frozen at the typed value (it only refreshed after clicking outside the canvas), and Delete/Backspace edited the number field instead of removing the selected annotation. A pointer interaction on the stage now blurs a focused coordinate input, so the field syncs live with the drag, Delete removes the shape, and the selection no longer feels "stuck". Typing a value and pressing Delete *inside* the field still edits the number, as before.
