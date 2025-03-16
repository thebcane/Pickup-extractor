const { exec } = require('child_process');

function runFFmpegCommand(command, callback) {
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing FFmpeg: ${error.message}`);
            return callback(error);
        }
        if (stderr) {
            console.error(`FFmpeg stderr: ${stderr}`);
        }
        callback(null, stdout);
    });
}

module.exports = { runFFmpegCommand }; // Export for use in app.js
