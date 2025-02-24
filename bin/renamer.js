const fs = require('fs');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const haversine = require('haversine');

// Get user inputs
const directory = process.argv[2];
const durationMinutes = parseInt(process.argv[3]) || 15;
const distanceThreshold = parseInt(process.argv[4]) || 100; // meters

const durationMs = durationMinutes * 60 * 1000;

async function processFiles() {
  try {
    // Read and filter media files
    const files = fs.readdirSync(directory)
      .filter(f => /\.(jpg|jpeg|png|mp4|mov|avi|heic|gif|cr2|dng)$/i.test(f))
      .map(f => path.join(directory, f));

    // Extract metadata
    const filesWithMeta = await Promise.all(files.map(async file => {
      const tags = await exiftool.read(file);
      const dateTime = tags.DateTimeOriginal || tags.CreateDate;
      const timestamp = dateTime ? new Date(dateTime).getTime() : null;
      const lat = tags.GPSLatitude;
      const lon = tags.GPSLongitude;
      return { 
        path: file, 
        timestamp, 
        lat, 
        lon,
        originalName: path.basename(file)
      };
    }));

    // Filter files with valid timestamps and sort
    const validFiles = filesWithMeta.filter(f => f.timestamp);
    validFiles.sort((a, b) => a.timestamp - b.timestamp);

    // Group files
    const groups = [];
    let currentGroup = [validFiles[0]];

    for (let i = 1; i < validFiles.length; i++) {
      const currentFile = validFiles[i];
      const lastFile = currentGroup[currentGroup.length - 1];

      // Calculate time difference
      const timeDiff = currentFile.timestamp - lastFile.timestamp;
      let isNewGroup = timeDiff > durationMs;

      // Check location difference if both have coordinates
      if (!isNewGroup && lastFile.lat && lastFile.lon && currentFile.lat && currentFile.lon) {
        const start = { latitude: lastFile.lat, longitude: lastFile.lon };
        const end = { latitude: currentFile.lat, longitude: currentFile.lon };
        const distance = haversine(start, end, { unit: 'meter' });
        isNewGroup = distance > distanceThreshold;
      }

      if (isNewGroup) {
        groups.push(currentGroup);
        currentGroup = [currentFile];
      } else {
        currentGroup.push(currentFile);
      }
    }
    groups.push(currentGroup); // Add final group

    // Rename files with sequence numbers
    groups.forEach((group, index) => {
      const groupName = `Location${index + 1}`;
      group.forEach((file, fileIndex) => {
        const ext = path.extname(file.path);
        let newName = `${groupName}_${String(fileIndex + 1).padStart(3, '0')}${ext}`;
        let newPath = path.join(directory, newName);
        
        // Ensure no filename conflicts
        let counter = 1;
        while (fs.existsSync(newPath)) {
          newName = `${groupName}_${String(fileIndex + 1).padStart(3, '0')}_${counter}${ext}`;
          newPath = path.join(directory, newName);
          counter++;
        }

        fs.renameSync(file.path, newPath);
        console.log(`Renamed ${file.originalName} => ${newName}`);
      });
    });

    console.log(`Processed ${validFiles.length} files into ${groups.length} groups`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    exiftool.end();
  }
}

// Check for required directory input
if (!directory) {
  console.log('Usage: node script.js <directory> [duration_minutes] [distance_meters]');
  console.log('Example: node organizer.js ~/Photos 30 200');
  process.exit(1);
}

// Add this at the very end of the file:
if (require.main === module) {
  // Check for required directory input
  if (!process.argv[2]) {
    console.log('Usage: content-renamer <directory> [duration_minutes] [distance_meters]');
    console.log('Example: content-renamer ~/Photos 30 200');
    process.exit(1);
  }

  processFiles();
}

// node organiser.js ~/Downloads/Personal/Trip/UzbekistanDone 30 250
