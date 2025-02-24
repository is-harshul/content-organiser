# Media Group Renamer 🖼️📹

A CLI tool to organize media files by timestamp and geolocation metadata

## Features
- Groups media files by time and location metadata
- Configurable time window (default 15 minutes)
- Configurable distance threshold (default 100 meters)
- Supports common photo/video formats
- Prevents filename conflicts
- Preserves file extensions

## Installation
```bash
npm install -g media-group-renamer
```

## Usage
```bash
media-group <directory> [duration_minutes] [distance_meters]
```

### Examples
```bash
# Basic usage with defaults
media-group ~/Photos

# Custom grouping parameters
media-group ~/Videos 30 200
```

## Configuration
| Parameter | Default | Description |
|-----------|---------|-------------|
| directory | - | Path to media files (required) |
| duration_minutes | 15 | Max minutes between files in a group |
| distance_meters | 100 | Max distance between files in a group |

## Output
Files will be renamed in the format:
~
Location1_001.jpg
Location1_002.mp4
Location2_001.png
~

## Notes
- Files without valid timestamps will be ignored
- Requires ExifTool installed on system
- Always backup files before processing

## License
MIT © [Harshul Kansal](https://github.com/is-harshul)