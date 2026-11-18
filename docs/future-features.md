# 将来の機能

画面には表示していないものの、将来再開できるよう内部の処理が残っている機能を記録します。

<a id="manual-markers-add-marker"></a>

## 手動マーカー（Add marker）

マーカーは録画中に、いま行っている作業などを利用者が記録するメモです。従来は録画画面のボタンから、操作を中断する入力ダイアログを開いていました。音声解説で作業の目的を手を止めずに時刻付きで記録できるようになり、ボタンを廃止しました。入力ダイアログが録画に映り込むことや、解析でマーカーのための画面切り替えを余分な操作とみなす問題も避けられます。

| 層 | 実装箇所 |
| --- | --- |
| レンダラーのブリッジ | `electron/preload.cjs` の `window.skillRecorder.marker` |
| IPC チャネルと結果の型 | `common/ipc.ts`、`electron/ipc.ts` |
| 録画処理 | `electron/recorder/controller.ts` の `marker()` |
| イベントの型とデータ | `common/events.ts` の `EventType.Marker`、`MarkerPayload` |
| イベントの関連付けとまとめ処理 | `common/correlation.ts`、`common/bundle.ts` の `step.markers` |
| 説明への反映 | `common/describe.ts`、解析とスキル作成の `tools.ts` |

`src/Recorder.tsx` の `Add marker` ボタンと `addMarker` ハンドラー、`src/App.css` の `.marker` スタイルを削除済みです。

再導入する場合は、録画を中断しないトリガーを使います。たとえば、グローバルショートカットで現在の時刻に印を付け、必要に応じて短いメモを添えられる方式なら、継続して記録する音声解説と併用できます。`window.prompt` のようなブロッキングダイアログは避けます。
