#!/usr/bin/env node

import { defineCommand, runMain } from 'citty';
import { exiftool } from 'exiftool-vendored';
import haversine from 'haversine';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import ora from 'ora';

// Fix for CommonJS enquirer
import enquirerPkg from 'enquirer';
const { prompt } = enquirerPkg;

// Helper function to resolve paths
function resolvePath(inputPath) {
  if (inputPath.startsWith('~')) {
    return `${homedir()}${inputPath.slice(1)}`;
  }
  return path.resolve(inputPath);
}

// Main processing function
async function processFiles(directory, durationMinutes = 15, distanceMeters = 100) {
  const spinner = ora('Processing files...').start();

  try {
    const durationMs = durationMinutes * 60 * 1000;
    
    // Read and filter media files
    spinner.text = 'Reading files...';
    const files = fs.readdirSync(directory)
      .filter(f => /\.(jpg|jpeg|png|mp4|mov|avi|heic|gif|cr2|dng)$/i.test(f))
      .map(f => path.join(directory, f));

    // Extract metadata
    spinner.text = 'Extracting metadata...';
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

    // Filter and sort files
    spinner.text = 'Sorting files...';
    const validFiles = filesWithMeta.filter(f => f.timestamp);
    validFiles.sort((a, b) => a.timestamp - b.timestamp);

    // Group files
    spinner.text = 'Grouping files...';
    const groups = [];
    let currentGroup = [validFiles[0]];

    for (let i = 1; i < validFiles.length; i++) {
      const currentFile = validFiles[i];
      const lastFile = currentGroup[currentGroup.length - 1];

      // Calculate time difference
      const timeDiff = currentFile.timestamp - lastFile.timestamp;
      let isNewGroup = timeDiff > durationMs;

      // Check location difference
      if (!isNewGroup && lastFile.lat && lastFile.lon && currentFile.lat && currentFile.lon) {
        const start = { latitude: lastFile.lat, longitude: lastFile.lon };
        const end = { latitude: currentFile.lat, longitude: currentFile.lon };
        const distance = haversine(start, end, { unit: 'meter' });
        isNewGroup = distance > distanceMeters;
      }

      if (isNewGroup) {
        groups.push(currentGroup);
        currentGroup = [currentFile];
      } else {
        currentGroup.push(currentFile);
      }
    }
    groups.push(currentGroup);

    // Rename files
    spinner.text = 'Renaming files...';
    groups.forEach((group, index) => {
      const groupName = `Location${index + 1}`;
      group.forEach((file, fileIndex) => {
        const ext = path.extname(file.path);
        let newName = `${groupName}_${String(fileIndex + 1).padStart(3, '0')}${ext}`;
        let newPath = path.join(directory, newName);
        
        // Handle filename conflicts
        let counter = 1;
        while (fs.existsSync(newPath)) {
          newName = `${groupName}_${String(fileIndex + 1).padStart(3, '0')}_${counter}${ext}`;
          newPath = path.join(directory, newName);
          counter++;
        }

        fs.renameSync(file.path, newPath);
        console.log(`✅ Renamed ${file.originalName} => ${newName}`);
      });
    });

    spinner.succeed(`Successfully organized ${validFiles.length} files into ${groups.length} groups!`);
  } catch (error) {
    spinner.fail(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    exiftool.end();
  }
}

// CLI Definition
const main = defineCommand({
  meta: {
    name: 'content-renamer',
    version: '1.0.0',
    description: 'Organize media files by timestamp and geolocation metadata'
  },
  args: {
    directory: {
      type: 'string',
      description: 'Path to media files',
      required: false
    },
    duration: {
      type: 'string',
      description: 'Max minutes between files in a group (default: 15)',
      default: '15'
    },
    distance: {
      type: 'string',
      description: 'Max distance between files in meters (default: 100)',
      default: '100'
    },
    interactive: {
      type: 'boolean',
      description: 'Run in interactive mode',
      alias: 'i',
      default: false
    }
  },
  async run({ args }) {
    if (args.interactive || !args.directory) {
      console.log('🏞️ Welcome to Content Renamer!');
      console.log('Let\'s organize your media files...\n');

      const responses = await prompt([
        {
          type: 'input',
          name: 'directory',
          message: `📂 Enter the path to your media files: ${homedir()}`,
          validate: value => {
            const resolvedPath = resolvePath(value);
            return fs.existsSync(resolvedPath) || `Directory does not exist: ${resolvedPath}`;
          }
        },
        {
          type: 'numeral',
          name: 'duration',
          message: '⏱️  Maximum minutes between files in a group:',
          initial: parseInt(args.duration),
          validate: value => value > 0 || 'Must be a positive number!'
        },
        {
          type: 'numeral',
          name: 'distance',
          message: '📍 Maximum distance between files in meters:',
          initial: parseInt(args.distance),
          validate: value => value > 0 || 'Must be a positive number!'
        }
      ]);

      args.directory = responses.directory;
      args.duration = responses.duration;
      args.distance = responses.distance;
    }

    console.log('\n🚀 Starting organization process...');
    await processFiles(resolvePath(args.directory), parseInt(args.duration), parseInt(args.distance));
  }
});

runMain(main);