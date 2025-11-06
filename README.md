# Arkium

A custom Chromium-based web browser built with Electron.

## Features

- 🌐 Full web browsing capabilities powered by Chromium
- 🎨 Modern, dark-themed UI
- ⌨️ Keyboard shortcuts for quick navigation
- 🔍 Smart address bar (search or navigate)
- 🔒 Secure browsing with HTTPS support

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Browser

```bash
npm start
```

For development mode with DevTools:
```bash
npm run dev
```

## Keyboard Shortcuts

- `Cmd/Ctrl + L` - Focus address bar
- `Cmd/Ctrl + R` - Reload page
- `Cmd/Ctrl + [` - Go back
- `Cmd/Ctrl + ]` - Go forward
- `Cmd/Ctrl + H` - Go to homepage

## Project Structure

```
Arkium/
├── main.js          # Electron main process
├── index.html       # Browser UI
├── styles.css       # Browser styling
├── renderer.js      # Browser functionality
├── package.json     # Project configuration
└── README.md        # Documentation
```

## Technologies Used

- **Electron** - Desktop application framework
- **Chromium** - Web rendering engine (included in Electron)
- **Node.js** - Backend runtime

## Future Enhancements

- [ ] Tab management
- [ ] Bookmarks system
- [ ] History tracking
- [ ] Download manager
- [ ] Extensions support
- [ ] Custom themes
- [ ] Privacy controls

## License

MIT
