# Share to Apps - macOS/iOS Share Extension

This extension allows you to share content from any app (Notes, Safari, etc.) directly to Claude, ChatGPT, or Terminal.

## Features

- Share text, URLs, and images from any app
- Direct integration with Claude (app and web)
- Direct integration with ChatGPT (app and web)
- Send content to Terminal
- Clean, native UI

## Installation

### Prerequisites
- Xcode 14.0 or later
- macOS 13.0+ or iOS 16.0+
- Developer account (for device testing)

### Setup Steps

1. **Open in Xcode**
   ```bash
   cd mac/ShareToApps
   open ShareToApps.xcodeproj
   ```
   (You'll need to create the Xcode project file)

2. **Configure Bundle Identifiers**
   - Main app: `com.yourname.ShareToApps`
   - Extension: `com.yourname.ShareToApps.ShareExtension`

3. **Enable App Groups** (if sharing data between app and extension)
   - In both targets, go to Capabilities
   - Enable App Groups
   - Add group: `group.com.yourname.ShareToApps`

4. **Build and Run**
   - Select your device or simulator
   - Build and run (⌘R)

## How to Use

1. **In any app** (Notes, Safari, Photos, etc.)
2. **Select content** you want to share
3. **Tap Share button** (square with arrow)
4. **Find "Share to Apps"** in the share sheet
   - If not visible, tap "More" and enable it
5. **Choose destination:**
   - Claude - Opens Claude app or web
   - ChatGPT - Opens ChatGPT app or web
   - Terminal - Saves content for Terminal access

## Creating the Xcode Project

Since we need an actual Xcode project file, here's how to set it up:

1. Open Xcode
2. Create new project → iOS → App
3. Product Name: ShareToApps
4. Add new target → iOS → Share Extension
5. Name: ShareExtension
6. Replace the generated files with the ones provided
7. Configure Info.plist files as provided

## URL Schemes

The extension tries these URL schemes in order:

### Claude
- App: `claude://new?text=<content>`
- Web fallback: `https://claude.ai/new?q=<content>`

### ChatGPT
- App: `chatgpt://new?text=<content>`
- Web fallback: `https://chat.openai.com/?q=<content>`

### Terminal
- Creates temporary file with content
- Shows file path for manual access

## Customization

### Adding More Apps

Edit `ShareViewController.swift` to add more destinations:

```swift
let newAppButton = createShareButton(
    title: "App Name",
    icon: "📱",
    action: #selector(shareToNewApp)
)

@objc private func shareToNewApp() {
    let content = prepareContent()
    // Add your app's URL scheme here
}
```

### Styling

Modify button appearance in `createShareButton()` method:
- Colors: Change `backgroundColor`
- Fonts: Modify `titleLabel?.font`
- Icons: Update emoji or use SF Symbols

## Troubleshooting

### Extension Not Appearing
1. Make sure it's enabled in Settings → More
2. Check activation rules in Info.plist
3. Rebuild and reinstall

### Apps Not Opening
1. Verify URL schemes are correct
2. Check if target apps are installed
3. Test web fallback URLs

### Content Not Sharing
1. Check data extraction in `extractSharedData()`
2. Verify content type support in Info.plist
3. Add debug logging to track data flow

## Privacy & Security

- No data is stored permanently
- Content is passed directly to chosen app
- Temporary files are system-managed
- No network requests except opening URLs

## License

MIT - Feel free to customize for your needs!