import { Menu, Tray, nativeImage } from "electron";

import { trayIcon } from "./icons";
import type { RecorderController } from "./recorder/controller";

/** Last-resort tray glyph drawn in code, used only if the icon assets are missing. */
function fallbackTrayIcon(): Electron.NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const r = size / 2 - 1;
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    const x = i % size;
    const y = Math.floor(i / size);
    const inside = (x - c) ** 2 + (y - c) ** 2 <= r * r;
    buf[o] = 42; // B
    buf[o + 1] = 54; // G
    buf[o + 2] = 237; // R
    buf[o + 3] = inside ? 255 : 0; // A
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

export function createTray(
  recorder: RecorderController,
  startRecording: () => Promise<unknown>,
  stopRecording: () => Promise<unknown>,
  showRecorderWindow: () => void,
  showRecordingControls: () => void,
): Tray {
  const tray = new Tray(trayIcon() ?? fallbackTrayIcon());
  tray.setToolTip("Skill Recorder 日本語版");

  const rebuild = () => {
    const recording = recorder.state === "recording";
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: recording ? "録画を停止" : "録画を開始",
          click: () => void (recording ? stopRecording() : startRecording()),
        },
        { type: "separator" },
        {
          label: recording ? "録画操作バーを表示" : "ウィンドウを表示",
          click: () => {
            if (recording) {
              showRecordingControls();
              return;
            }
            showRecorderWindow();
          },
        },
        { label: "終了", role: "quit" },
      ]),
    );
  };

  rebuild();
  recorder.onStatusChanged(rebuild);
  return tray;
}
