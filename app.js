const express = require('express');
const bodyParser = require('body-parser');
const { runFFmpegCommand } = require('./ffmpeg-utils'); // Your existing function
const mammoth = require('mammoth');  //If you process .docx on the server
const app = express();
const port = process.env.PORT || 3000; // Use environment variable or default

app.use(bodyParser.json({ limit: '50mb' })); // Handle potentially large DOCX content

app.post('/process', async (req, res) => {
    try {
        const { documentName, plainText, formattedText, talentName } = req.body;

        if (!plainText || !formattedText) {
            return res.status(400).json({ error: 'Missing document content' });
        }

        // --- Bracketed Text Extraction (from plainText) ---
        const bracketedPickups = [];
        if (plainText) { //Check if plain text exists.
            const bracketRegex = /$$(.*?)$$/g;  //  non-greedy matching
            let match;
            let contextIndex = 0;
            while ((match = bracketRegex.exec(plainText)) !== null) {
                const bracketText = match[1].trim();
                if (bracketText) {
                    const startPos = Math.max(0, match.index - 100);
                    const endPos = Math.min(plainText.length, match.index + match[0].length + 100);
                    const context = plainText.substring(startPos, endPos).trim();

                    contextIndex++;
                    bracketedPickups.push({
                        id: contextIndex, //Or some other unique ID>
                        highlightedText: bracketText,
                        context: context,
                        annotationType: 'bracket',
                        annotationSubtype: 'square-brackets', // Adjust as needed
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }

        // --- Formatted Text Extraction ---

        const formattedPickups = [];

        if (formattedText) //Check that formattedText exists.
        {
            formattedText.forEach((segment, index) => {

                let annotationType = null;
                let annotationSubtype = null;

                if (segment.isBold) {
                    annotationType = 'bold';
                    annotationSubtype = 'bold-text';
                } else if (segment.isUnderline) {
                    annotationType = 'underline';
                    annotationSubtype = 'underline-text';
                } else if (segment.backgroundColor) {  // Check for ANY background color
                    annotationType = 'highlight';
                    annotationSubtype = 'background-color';
                }
                //Add more checks as needed (strikethrough, etc.)

                if (annotationType) {
                    // Find the context. Since we have start/end indexes, this is better:
                    const contextStart = Math.max(0, segment.startIndex - 100);
                    const contextEnd = Math.min(plainText.length, segment.endIndex + 100);
                    const context = plainText.substring(contextStart, contextEnd).trim();

                    formattedPickups.push({
                        id: formattedPickups.length + 1, //Simple ID.  Use a UUID in production.
                        highlightedText: segment.text,
                        context: context,
                        annotationType: annotationType,
                        annotationSubtype: annotationSubtype,
                        timestamp: new Date().toISOString(),
                    });
                }
            });
        }


        // Combine pickups
        const allPickups = [...bracketedPickups, ...formattedPickups];

        // Remove duplicates (based on highlightedText, adjust as needed)
        const uniquePickups = [];
        const seenText = new Set();
        for (const pickup of allPickups) {
            if (!seenText.has(pickup.highlightedText)) {
                uniquePickups.push(pickup);
                seenText.add(pickup.highlightedText);
            }
        }

        // Send the extracted pickups back to the Google Script
        res.status(200).json({
            message: 'Pickups extracted successfully',
            pickups: uniquePickups,
            talentName: talentName // Echo back any other data you want
        });

    } catch (error) {
        console.error('Error processing document:', error);
        res.status(500).json({ error: 'Failed to process document', details: error.message });
    }
});

// Simple route for testing
app.get('/', (req, res) => {
    res.send('Pickup Extractor Server is running!');
});

app.listen(port, () => {
    console.log(`Pickup Extractor server listening on port ${port}`);
});
