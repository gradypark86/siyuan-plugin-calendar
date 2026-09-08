# SiYuan Note Calendar Panel Plugin

[简体中文](https://github.com/gradypark86/siyuan-plugin-calendar/blob/main/README.md) \| English

A SiYuan Note calendar panel plugin that allows quick creation of periodic notes such as daily, weekly, monthly, and yearly notes, with automatic template loading support.

![Project Screenshot](https://imgs.pprain.space/2026/01/41d3d243f69952db7cf91a75d4963246.png)

## Main Features

- Calendar Features
  - Optional button entry location
  - Optional display of week numbers
  - Optional start day of the week (Sunday/Monday)
  - Optional week number rule (calendar week / ISO 8601, under Advanced settings; switching rules does not affect existing weekly notes)
  - Adaptive width scaling in sidebar mode
  - Click on a date to quickly create or jump to that day's daily note
  - Support switching between multiple notebooks
- Periodic Note Features
  - Optional weekly note feature; when enabled, click on the week number to create a corresponding weekly note, or automatically create the current week's note when creating a daily note
  - Supports customizing creation paths and templates for weekly, monthly, and yearly notes
- Custom Configuration
  - Configure the time when a new day begins
- Support for all platforms
- Document attributes and “Backfill Attributes”
  - Since v0.5.0, periodic notes created through the panel automatically get document attributes. For periodic notes that already have attributes, the panel can still locate and open the original note through its attributes even if you later change its title or storage path.
  - When loading week numbers, the panel first uses document attributes to determine whether a weekly note exists. For historical weekly notes without attributes, clicking the corresponding week number attempts a storage-path lookup and automatically backfills the attributes when the note is found.
  - “Backfill Attributes” iterates through the configured weekly, monthly, and yearly paths from January 2025 onward, then scans common storage-path formats with regular-expression rules to cover as many older or specially named periodic notes as possible.
  - Before changing periodic-note paths or the week-number rule, we recommend running “Backfill Attributes” under Advanced Settings to avoid creating blank weekly notes when existing notes cannot be located. Custom paths that cannot be recognized automatically may still require clicking the corresponding periodic-note entry to backfill manually.

## References and Thanks

- This project is modified based on [Siyuan Arco Calendar](https://github.com/svchord/siyuan-arco-calendar), thank you very much.
- The weekly note functionality was added based on the blue print of [Obsidian Calendar Plugin](https://github.com/liamcain/obsidian-calendar-plugin), thank you very much.
- The periodic note functionality was added based on the blueprint of [Obsidian Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes), thank you very much.
- This project was completed with the assistance of GitHub Copilot, thank you very much.
- Thank you for using this plugin. Still learning the ropes of plugin development—thanks for your patience if things aren't perfect yet! Issues and PRs are welcome.

## License

MIT License
