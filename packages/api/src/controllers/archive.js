const fs = require('fs-extra');
const readline = require('readline');
const path = require('path');
const { archivedir, clearArchiveLinksCache, resolveArchiveFolder } = require('../utility/directories');
const socket = require('../utility/socket');
const { saveFreeTableData } = require('../utility/freeTableStorage');
const loadFilesRecursive = require('../utility/loadFilesRecursive');
const getJslFileName = require('../utility/getJslFileName');
const { getLogger } = require('dbgate-tools');
const uuidv1 = require('uuid/v1');
const dbgateApi = require('../shell');

const logger = getLogger('archive');

module.exports = {
  folders_meta: true,
  async folders() {
    const folders = await fs.readdir(archivedir());
    return [
      {
        name: 'default',
        type: 'jsonl',
      },
      ...folders
        .filter(x => x != 'default')
        .map(name => ({
          name,
          type: 'jsonl',
        })),
    ];
  },

  createFolder_meta: true,
  async createFolder({ folder }) {
    await fs.mkdir(path.join(archivedir(), folder));
    socket.emitChanged('archive-folders-changed');
    return true;
  },

  createLink_meta: true,
  async createLink({ linkedFolder }) {
    const folder = await this.getNewArchiveFolder({ database: path.parse(linkedFolder).name + '.link' });
    fs.writeFile(path.join(archivedir(), folder), linkedFolder);
    clearArchiveLinksCache();
    socket.emitChanged('archive-folders-changed');
    return folder;
  },

  files_meta: true,
  async files({ folder }) {
    try {
      const dir = resolveArchiveFolder(folder);
      if (!(await fs.exists(dir))) return [];
      const files = await loadFilesRecursive(dir); // fs.readdir(dir);

      function fileType(ext, type) {
        return files
          .filter(name => name.endsWith(ext))
          .map(name => ({
            name: name.slice(0, -ext.length),
            label: path.parse(name.slice(0, -ext.length)).base,
            type,
          }));
      }

      return [
        ...fileType('.jsonl', 'jsonl'),
        ...fileType('.table.yaml', 'table.yaml'),
        ...fileType('.view.sql', 'view.sql'),
        ...fileType('.proc.sql', 'proc.sql'),
        ...fileType('.func.sql', 'func.sql'),
        ...fileType('.trigger.sql', 'trigger.sql'),
        ...fileType('.matview.sql', 'matview.sql'),
      ];
    } catch (err) {
      logger.error({ err }, 'Error reading archive files');
      return [];
    }
  },

  refreshFiles_meta: true,
  async refreshFiles({ folder }) {
    socket.emitChanged('archive-files-changed', { folder });
    return true;
  },

  refreshFolders_meta: true,
  async refreshFolders() {
    socket.emitChanged(`archive-folders-changed`);
    return true;
  },

  deleteFile_meta: true,
  async deleteFile({ folder, file, fileType }) {
    await fs.unlink(path.join(resolveArchiveFolder(folder), `${file}.${fileType}`));
    socket.emitChanged(`archive-files-changed`, { folder });
    return true;
  },

  renameFile_meta: true,
  async renameFile({ folder, file, newFile, fileType }) {
    await fs.rename(
      path.join(resolveArchiveFolder(folder), `${file}.${fileType}`),
      path.join(resolveArchiveFolder(folder), `${newFile}.${fileType}`)
    );
    socket.emitChanged(`archive-files-changed`, { folder });
    return true;
  },

  saveChangeSet_meta: true,
  async saveChangeSet({ folder, file, changeSet }) {
    const changedFilePath = path.join(resolveArchiveFolder(folder), `${file}.jsonl`);
    const tmpchangedFilePath = path.join(resolveArchiveFolder(folder), `${file}-${uuidv1()}.jsonl`);
    const reader = await dbgateApi.changeSetOverJsonLinesReader({ fileName: changedFilePath, changeSet });
    const writer = await dbgateApi.jsonLinesWriter({ fileName: tmpchangedFilePath });
    await dbgateApi.copyStream(reader, writer);
    await fs.unlink(changedFilePath);
    await fs.rename(path.join(tmpchangedFilePath), path.join(changedFilePath));
    return true;
  },

  renameFolder_meta: true,
  async renameFolder({ folder, newFolder }) {
    const uniqueName = await this.getNewArchiveFolder({ database: newFolder });
    await fs.rename(path.join(archivedir(), folder), path.join(archivedir(), uniqueName));
    socket.emitChanged(`archive-folders-changed`);
    return true;
  },

  deleteFolder_meta: true,
  async deleteFolder({ folder }) {
    if (!folder) throw new Error('Missing folder parameter');
    if (folder.endsWith('.link')) {
      await fs.unlink(path.join(archivedir(), folder));
    } else {
      await fs.rmdir(path.join(archivedir(), folder), { recursive: true });
    }
    socket.emitChanged(`archive-folders-changed`);
    return true;
  },

  saveFreeTable_meta: true,
  async saveFreeTable({ folder, file, data }) {
    await saveFreeTableData(path.join(resolveArchiveFolder(folder), `${file}.jsonl`), data);
    socket.emitChanged(`archive-files-changed`, { folder });
    return true;
  },

  loadFreeTable_meta: true,
  async loadFreeTable({ folder, file }) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(path.join(resolveArchiveFolder(folder), `${file}.jsonl`));
      const liner = readline.createInterface({
        input: fileStream,
      });
      let structure = null;
      const rows = [];
      liner.on('line', line => {
        const data = JSON.parse(line);
        if (structure) rows.push(data);
        else structure = data;
      });
      liner.on('close', () => {
        resolve({ structure, rows });
        fileStream.close();
      });
    });
  },

  saveText_meta: true,
  async saveText({ folder, file, text }) {
    await fs.writeFile(path.join(resolveArchiveFolder(folder), `${file}.jsonl`), text);
    socket.emitChanged(`archive-files-changed`, { folder });
    return true;
  },

  saveJslData_meta: true,
  async saveJslData({ folder, file, jslid }) {
    const source = getJslFileName(jslid);
    const target = path.join(resolveArchiveFolder(folder), `${file}.jsonl`);
    await fs.copyFile(source, target);
    socket.emitChanged(`archive-files-changed`, { folder });
    return true;
  },

  async getNewArchiveFolder({ database }) {
    const isLink = database.endsWith(database);
    const name = isLink ? database.slice(0, -5) : database;
    const suffix = isLink ? '.link' : '';
    if (!(await fs.exists(path.join(archivedir(), database)))) return database;
    let index = 2;
    while (await fs.exists(path.join(archivedir(), `${name}${index}${suffix}`))) {
      index += 1;
    }
    return `${name}${index}${suffix}`;
  },
};
