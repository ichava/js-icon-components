# Flutter

`dist/assets/<pack>/flutter.zip` is the Flutter export: the pack's SVGs as Flutter assets, a Dart file of their paths, and the `pubspec.yaml` lines that declare them, for `flutter_svg`.

## Files

| Entry | Holds |
|---|---|
| `assets/ichava/<pack>/<set>/<name>.svg` | each icon, written from its checked tree |
| `assets/ichava/<pack>/ATTRIBUTION.md`, `LICENSE` | the pack's attribution and licence |
| `lib/ichava_<pack>_icons.dart` | `const String iconMug = 'assets/ichava/tabler/outline/mug.svg';`, one per icon |
| `pubspec.fragment.yaml` | the `flutter_svg` dependency and one `assets:` directory per set |

No Dart package is published; the export is files you copy into your app.

## Usage

Unzip into your Flutter project's root, merge `pubspec.fragment.yaml` into `pubspec.yaml`, then:

```dart
import 'package:flutter_svg/flutter_svg.dart';
import 'ichava_tabler_icons.dart';

SvgPicture.asset(
  iconMug,
  width: 20,
  colorFilter: const ColorFilter.mode(Color(0xFF7C3AED), BlendMode.srcIn),
)
```

Constant names are the export names with a lower-case first letter, so `IconMugFilled` is
`iconMugFilled`. Tabler paints with `currentColor`, which `flutter_svg` takes from
`SvgTheme(currentColor: …)`; a colour filter recolours any icon.

## Size

16.1 MB across the four packs, in about a second.

## Tests

`tests/assets.test.ts` parses `pubspec.fragment.yaml` as YAML, checks every path in the Dart file
exists in the zip and sits under a declared assets directory, and the count guard counts the SVGs.

## Format id

`flutter`, a native asset export (`native: true`) in icon-browser's format registry since schema 1.6.0.

---

[← Docs index](../../README.md#documentation)
