import { TableInfo } from 'dbgate-types';
import { PerspectiveDisplay } from '../PerspectiveDisplay';
import { PerspectiveTableNode } from '../PerspectiveTreeNode';
import { chinookDbInfo } from './chinookDbInfo';
import { createPerspectiveConfig } from '../PerspectiveConfig';
import artistDataFlat from './artistDataFlat';
import artistDataAlbum from './artistDataAlbum';
import artistDataAlbumTrack from './artistDataAlbumTrack';

test('test flat view', () => {
  const artistTable = chinookDbInfo.tables.find(x => x.pureName == 'Artist');
  const root = new PerspectiveTableNode(artistTable, chinookDbInfo, createPerspectiveConfig(), null, null, null, null);
  const display = new PerspectiveDisplay(root, artistDataFlat);

  console.log(display.rows);
  expect(display.rows.length).toEqual(5);
  expect(display.rows[0]).toEqual(
    expect.objectContaining({
      rowData: ['AC/DC'],
    })
  );
});

test('test one level nesting', () => {
  const artistTable = chinookDbInfo.tables.find(x => x.pureName == 'Artist');
  const root = new PerspectiveTableNode(
    artistTable,
    chinookDbInfo,
    { ...createPerspectiveConfig(), checkedColumns: ['Artist.Album'] },
    null,
    null,
    null,
    null
  );
  const display = new PerspectiveDisplay(root, artistDataAlbum);

  console.log(display.rows);
  expect(display.rows.length).toEqual(7);
  expect(display.rows[0]).toEqual(
    expect.objectContaining({
      rowData: ['AC/DC', 'For Those About To Rock We Salute You'],
      rowSpans: [2, 1],
      rowCellSkips: [false, false],
    })
  );
  expect(display.rows[1]).toEqual(
    expect.objectContaining({
      rowData: [undefined, 'Let There Be Rock'],
      rowSpans: [1, 1],
      rowCellSkips: [true, false],
    })
  );
  expect(display.rows[5]).toEqual(
    expect.objectContaining({
      rowData: ['Alanis Morissette', 'Jagged Little Pill'],
      rowSpans: [1, 1],
    })
  );
});

test('test two level nesting', () => {
  const artistTable = chinookDbInfo.tables.find(x => x.pureName == 'Artist');
  const root = new PerspectiveTableNode(
    artistTable,
    chinookDbInfo,
    { ...createPerspectiveConfig(), checkedColumns: ['Artist.Album', 'Artist.Album.Track'] },
    null,
    null,
    null,
    null
  );
  const display = new PerspectiveDisplay(root, artistDataAlbumTrack);

  console.log(display.rows);
  expect(display.rows.length).toEqual(9);
  // expect(display.rows[0]).toEqual(
  //   expect.objectContaining({
  //     rowData: ['AC/DC', 'For Those About To Rock We Salute You'],
  //     rowSpans: [2, 1],
  //   })
  // );
  // expect(display.rows[5]).toEqual(
  //   expect.objectContaining({
  //     rowData: ['Alanis Morissette', 'Jagged Little Pill'],
  //     rowSpans: [1, 1],
  //   })
  // );
});
