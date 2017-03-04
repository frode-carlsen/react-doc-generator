#!/usr/bin/env node
// https://github.com/team-767/simple-react-docgen/blob/master/src/simple-react-docgen.js
import { parse, resolver } from 'react-docgen'
import fs from 'fs';
import path from 'path';
import Command from 'commander';
import { readFiles } from 'node-dir';
import Handlebars from 'handlebars';
import Colors from 'colors';
import Table from 'cli-table';

const pkg = require('../package.json');


const table = new Table({
    head: [
        Colors.cyan('Path'),
        Colors.cyan('Status')
    ]
});

Handlebars.registerHelper('inc', (value, options) => {
    return parseInt(value) + 1;
});

const list = (val) => {
    val = val.replace(/[, ]+/g, ",").trim();
    return val.split(',').filter(value => value.length > 0);
}

console.log(Colors.white(`\n\nREACT DOC GENERATOR v${pkg.version}`));

Command
  .version(pkg.version)
  .usage(`<dir> [options]`)
  .option('-x, --extensions <items>', 'Include only these file extensions.', list, ['js', 'jsx'])
  .option('-i, --ignore <items>', 'Folders to ignore.', list, ['node_modules', '__tests__', '__mocks__'])
  .option('-e, --exclude-patterns <items>', 'Filename patterns to exclude.', list, [])
  .option('-t, --title [title]>', 'Document title', 'Components')
  .option('-o, --output <file>', 'Markdown file to write.', 'README.MD')
  .parse(process.argv);

const output = fs.createWriteStream(Command.output);
const templateData = {
    files: [],
    version: pkg.version,
    documentTitle: Command.title
};

const template = Handlebars.compile(`${fs.readFileSync(path.join(__dirname, 'template.handlebars'))}`);

if (Command.args.length !== 1) {
    console.log(`${Colors.red('Please specify <dir> as the first argument!')}`);
    Command.help();
} else {
    readFiles(
        Command.args[0],
        {
            match: new RegExp('\\.(?:' + Command.extensions.join('|') + ')$'),
            exclude: Command.excludePatterns,
            excludeDir: Command.ignore,
        },
        (err, content, filename, next) => {
            if (err) {
                throw err;
            }

            try {
                let components = parse(content, resolver.findAllExportedComponentDefinitions);
                components = components.map(component => {
                    if (component.description && !component.displayName) {
                        component.title = component.description.match(/^(.*)$/m)[0];
                        if (component.description.split('\n').length > 1) {
                            component.description = component.description.replace(/[\w\W]+?\n+?/, '');
                            component.description = component.description.replace(/(\n)/gm, '   \n');
                        } else {
                            component.description = null;
                        }
                    } else {
                        component.title = component.displayName;
                    }

                    return component;
                });
                templateData.files.push({ filename, components });
                table.push([
                    filename,
                    Colors.green(`OK.`)
                ]);
            } catch (e) {
                table.push([
                    filename,
                    Colors.red(`You have to export at least one valid React Class!`)
                ]);
            }

            next();
        },
        err => {
            if (err) {
                throw err;
            }

            if (templateData.files.length === 0) {
                let extensions = Command.extensions.map(ext => {
                    return `\`*.${ext}\``;
                });
                console.log(`${Colors.bold.yellow('Warning:')} ${Colors.yellow(`Could not find any files matching the file type: ${extensions.join(' OR ')}`)}\n`);
            } else {
                console.log(`${table.toString()}\n\n`);
            }

            output.write(template(templateData));
        }
    );
}