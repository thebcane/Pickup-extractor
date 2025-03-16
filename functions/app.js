// functions/app.js
const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const { runFFmpegCommand } = require('../ffmpeg-utils'); // You're probably not using this in this function
const mammoth = require('mammoth'); // You're probably not using this either, since you're processing in the Google Script

const app = express();
const router = express.Router();

app.use(bodyParser.json({ limit: '50mb' }));

router.post('/process', async (req, res) => {
    try {
        console.time('Total Processing Time'); // Start timer for the entire request

        const { documentName, plainText, formattedText, talentName } = req.body;

        if (!plainText || !formattedText) {
            return res.status(400).json({ error: 'Missing document content' });
        }

        // --- Optimized Bracketed Text Extraction ---
        const bracketedPickups = [];
        if (plainText) {
            const bracketRegex = /$$(.*?)$$/g;
            let match;
            let contextIndex = 0;
            while ((match = bracketRegex.exec(plainText)) !== null) {
                const bracketText = match[1].trim();
                if (bracketText) {
                    //  Optimized context extraction:  Only get context if there's bracketed text.
                    const startPos = Math.max(0, match.index - 100);
                    const endPos = Math.min(plainText.length, match.index + match[0].length + 100);
                    const context = plainText.substring(startPos, endPos).trim();

                    bracketedPickups.push({
                        id: ++contextIndex, // Use pre-increment for slightly better performance
                        highlightedText: bracketText,
                        context: context,
                        annotationType: 'bracket',
                        annotationSubtype: 'square-brackets',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        // --- Optimized Formatted Text Extraction ---
        const formattedPickups = [];
        if (formattedText) { // Check for existence
            for (const segment of formattedText) { // Use for...of loop for better performance
                let annotationType = null;
                let annotationSubtype = null;

                // Use simple if/else if for mutually exclusive conditions
                if (segment.isBold) {
                    annotationType = 'bold';
                    annotationSubtype = 'bold-text';
                } else if (segment.isUnderline) {
                    annotationType = 'underline';
                    annotationSubtype = 'underline-text';
                } else if (segment.backgroundColor) {
                    annotationType = 'highlight';
                    annotationSubtype = 'background-color';
                }

                if (annotationType) {
                    // Optimized context extraction:
                    const contextStart = Math.max(0, segment.startIndex - 100);
                    const contextEnd = Math.min(plainText.length, segment.endIndex + 100);
                    const context = plainText.substring(contextStart, contextEnd).trim();

                    formattedPickups.push({
                        id: formattedPickups.length + 1, //  Keep simple ID generation
                        highlightedText: segment.text,
                        context: context,
                        annotationType: annotationType,
                        annotationSubtype: annotationSubtype,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        }

        // --- Optimized Duplicate Removal ---
        const uniquePickups = [];
        const seenText = new Set();
        for (const pickup of [...bracketedPickups, ...formattedPickups]) { // Combine *after* individual processing
            if (!seenText.has(pickup.highlightedText)) {
                uniquePickups.push(pickup);
                seenText.add(pickup.highlightedText);
            }
        }

        // Send the extracted pickups back to the Google Script
        res.status(200).json({
            message: 'Pickups extracted successfully',
            pickups: uniquePickups,
            talentName: talentName
        });
        console.timeEnd('Total Processing Time'); // End timer for the entire request

    } catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({ error: 'Failed to process document', details: error.message });
        console.timeEnd('Total Processing Time'); // Ensure timer ends even on error
    }
});

// Keep the test route
router.get('/', (req, res) => {
    res.send('Pickup Extractor Server is running!');
});

app.use('/.netlify/functions/app', router);
module.exports.handler = serverless(app);
