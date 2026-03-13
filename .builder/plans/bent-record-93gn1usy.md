# No Code Changes Needed

The user asked a clarifying question about replacing/deleting sound files in the `resorces/sounds/` directory.

## Answer
- **Replacing sounds**: As long as the replacement file has the same filename and sits in the same folder, no code changes are needed. The app loads sounds by folder path and filename.
- **Deleting buzzers**: Only files present at build time in `resorces/sounds/Buzzers/` will be bundled via `extraResources`. The buzzer list endpoint dynamically scans the folder, so fewer files = smaller exe and shorter selection list.
- **Only two files are referenced by exact name in code**: `buzz in - correct.wav` and `buzz in - wrong.wav` in the `Misc` folder. These must keep their names. All other sounds (Buzzers, Countdown, Applause, Fail Sounds) are loaded dynamically by scanning their respective folders.

No code modifications required.
