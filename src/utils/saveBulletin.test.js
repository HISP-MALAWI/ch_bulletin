import saveBulletinToDataStore from './saveBulletin'

describe('saveBulletinToDataStore', () => {
  it('updates an existing bulletin instead of appending a duplicate', async () => {
    const existingBulletin = {
      id: 'bulletin-1',
      highlights: 'old highlight',
      status: 'draft',
    }

    const engine = {
      query: jest.fn().mockResolvedValue({ dataStore: [existingBulletin] }),
      mutate: jest.fn().mockResolvedValue({}),
    }

    const updatedBulletin = {
      id: 'bulletin-1',
      highlights: 'updated highlight',
      status: 'draft',
    }

    await saveBulletinToDataStore(updatedBulletin, engine)

    expect(engine.mutate).toHaveBeenCalledWith({
      resource: 'dataStore/CH_Bulletin/draft_bulletin',
      type: 'update',
      data: [updatedBulletin],
    })
  })
})
