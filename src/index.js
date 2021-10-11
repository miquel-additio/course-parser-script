const fs = require('fs');

/**
 * Global regular expressions
 */
const REGEX = {
    /**
     * Title of the section
     */
    title: new RegExp(/^(Mòdul|Módulo)/),

    /**
     * Item of the section
     */
    li: new RegExp(/^>{1}\s/),

    /**
     * Nested item of the section
     */
    nli: new RegExp(/^>{2}\s/),

    /**
     * Content file preffix
     */
    contentFile: new RegExp(/^(content)/),

    /**
     * Sectino file preffix
     */
    sectionFile: new RegExp(/^(section)/)
};

/**
 * Global configuration variables
 */
const CONFIG = {
    /**
     * Output folder
     */
    outputFolder: 'out',

    /**
     * Input folder
     */
    inputFolder: 'files',

    /**
     * Generated log file
     */
    logFile: 'errors.txt'
};

/**
 * Global variables
 */
const GLOBAL = {
    /**
     * Array of errors generated during file reading or writing
     */
    errors: []
};

/**
 * Checks the version of node that's being used. Exits the script
 * if the version is lower than 16.0
 */
const checkVersion = () => {
    const version = process.version.match(/^v(\d+\.\d+)/)[1];

    if (version < '16.0') {
        console.error('🔴 This script was built using node 16.8');
        process.exit(-1);
    }
};

/**
 * Checks if the output folder has does already exist to warn the user
 * that their files will be overwritten. If it does not exists, it creates
 * it
 */
const checkOutputFolder = () => {
    if (!fs.existsSync(CONFIG.outputFolder)) {
        console.log('\n🟢 Creating output folder...');
        fs.mkdirSync(CONFIG.outputFolder);
    } else {
        console.log('\n🟡 Output folder already exists, files WILL be overwritten!');
    }
};

/**
 * @typedef {ReadFileResult}
 * @prop {string} file The name of the read file
 * @prop {string[]} lines The read lines splitted on `\n`
 */

/**
 * Reads and returns the lines of the given file asynchronously
 *
 * @param {string} file File name to read
 * @returns {Promise<ReadFileResult>} The lines of the read file
 */
const readFile = (file) =>
    new Promise((res) => {
        fs.readFile(`${CONFIG.inputFolder}/${file}`, 'utf8', (error, lines) => {
            if (error) {
                console.error(`🔴 An error ocurred reading "${file}" and it will not be parsed!`);
                GLOBAL.errors.push({ file, error: JSON.stringify(error) });

                // Though it is an error, it is resolved so it reached
                // the then method properly
                res();
            } else {
                // We resolve an array of the read lines
                res({ file, lines: lines.split('\n') });
            }
        });
    });

/**
 * Appends the given file to the end of the file
 *
 * @param {string} file Name of the file
 * @param {string} line Line to `append` to the end of the file
 */
const writeLineToFile = (file) => (line) => {
    fs.appendFileSync(`${CONFIG.outputFolder}/${file}`, line);
};

/** Parses a content-type lines to its corresponding content
 *
 * @param {string[]} lines The lines to parse to HTML
 * @returns {string[]} The parsed HTML lines
 */
const parseContentToHTML = (lines) => {
    const content = [];

    content.push('<ul>');
    lines.forEach((line) => {
        content.push(Buffer.from(`<li class=\\"content-list-item\\">${line}</li>`));
    });
    content.push('</ul>');

    return content;
};

/**
 * Parses a section-type lines to its corresponding content
 *
 * @param {string[]} lines The lines to parse to HTML
 * @returns {string[]} The parsed HTML lines
 */
const parseSectionToHTML = (lines) => {
    let lastType = null;
    const section = [];

    lines.forEach((line) => {
        if (REGEX.li.test(line)) {
            if (lastType === 2) {
                section.push('</ul>');
                section.push('</div>');
            }

            section.push('<div class="section-item">');
            section.push(`${line.replace(REGEX.li, '')}`);

            lastType = 1;
        } else if (REGEX.nli.test(line)) {
            if (lastType === 1) {
                section.push('<ul class="section-item-list">');
            }

            section.push(`<li>${line.replace(REGEX.nli, '')}</li>`);

            lastType = 2;
        } else {
            switch (lastType) {
                // Will add on cascade
                case 2:
                    section.push('</ul>');
                    break;
                case 1:
                    section.push('</div>');
                case 0:
                    section.push('</div>');
            }

            section.push('<div class="section">');
            section.push(`<div class="section-title">${line.replace(REGEX.title, '')}</div>`);

            lastType = 0;
        }
    });

    if (lastType === 2) {
        section.push('</ul>');
        section.push('</div>');
    }
    section.push('</div>');

    return section;
};

/**
 * Parses the lines of a file
 *
 * @param {object} o
 * @param {string} o.file Name of the input file
 * @param {string[]} o.lines Lines of the file to parse
 */
const parseFileContent = ({ file, lines }) => {
    // Clear file content
    fs.writeFileSync(`${CONFIG.outputFolder}/${file}`, '');

    if (REGEX.contentFile.test(file)) {
        parseContentToHTML(lines).forEach(writeLineToFile(file));
    } else if (REGEX.sectionFile.test(file)) {
        parseSectionToHTML(lines).forEach(writeLineToFile(file));
    } else {
        GLOBAL.errors.push({
            file,
            error: `${file} does not have a "content" or "section" preffix`
        });
    }
};

/**
 * Prints errors stored in `GLOBAL.errors`
 */
const printErrors = () => {
    if (GLOBAL.errors.length) {
        fs.writeFileSync(
            `${CONFIG.outputFolder}/${CONFIG.logFile}`,
            `ERROR LOGS - ${new Date().toISOString()}\n`
        );

        GLOBAL.errors.forEach(({ file, error }) => {
            fs.appendFileSync(`${CONFIG.outputFolder}/${CONFIG.logFile}`, `[${file}]: ${error}\n`);
        });

        console.error(
            `\n🔴 ${GLOBAL.errors.length} error(s) occured. Check the logs for more information`
        );
    }
};

/**
 * @param {string[]} fileNames Files to parse inside `files/`
 */
const parseFiles = async (fileNames) => {
    return Promise.all(fileNames.map(readFile)).then((readFiles) => {
        checkOutputFolder();

        readFiles.map(parseFileContent);
        console.log('📦 Output files are in "out" folder');

        printErrors();
    });
};

/**
 * Automatically create and run the main function
 */
(main = async () => {
    checkVersion();

    console.log('🚀 Courses parser started!');

    await parseFiles(fs.readdirSync(CONFIG.inputFolder));

    console.log('\n🚀 Script completed!');
})();
