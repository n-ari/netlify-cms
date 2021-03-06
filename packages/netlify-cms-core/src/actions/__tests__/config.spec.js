import { fromJS } from 'immutable';
import { applyDefaults, detectProxyServer } from '../config';

jest.spyOn(console, 'log').mockImplementation(() => {});

describe('config', () => {
  describe('applyDefaults', () => {
    describe('publish_mode', () => {
      it('should set publish_mode if not set', () => {
        const config = fromJS({
          foo: 'bar',
          media_folder: 'path/to/media',
          public_folder: '/path/to/media',
          collections: [],
        });
        expect(applyDefaults(config).get('publish_mode')).toEqual('simple');
      });

      it('should set publish_mode from config', () => {
        const config = fromJS({
          foo: 'bar',
          publish_mode: 'complex',
          media_folder: 'path/to/media',
          public_folder: '/path/to/media',
          collections: [],
        });
        expect(applyDefaults(config).get('publish_mode')).toEqual('complex');
      });
    });

    describe('public_folder', () => {
      it('should set public_folder based on media_folder if not set', () => {
        expect(
          applyDefaults(
            fromJS({
              foo: 'bar',
              media_folder: 'path/to/media',
              collections: [],
            }),
          ).get('public_folder'),
        ).toEqual('/path/to/media');
      });

      it('should not overwrite public_folder if set', () => {
        expect(
          applyDefaults(
            fromJS({
              foo: 'bar',
              media_folder: 'path/to/media',
              public_folder: '/publib/path',
              collections: [],
            }),
          ).get('public_folder'),
        ).toEqual('/publib/path');
      });
    });

    describe('collections', () => {
      it('should strip leading slashes from collection folder', () => {
        expect(
          applyDefaults(
            fromJS({
              collections: [{ folder: '/foo' }],
            }),
          ).get('collections'),
        ).toEqual(fromJS([{ folder: 'foo' }]));
      });

      it('should strip leading slashes from collection files', () => {
        expect(
          applyDefaults(
            fromJS({
              collections: [{ files: [{ file: '/foo' }] }],
            }),
          ).get('collections'),
        ).toEqual(fromJS([{ files: [{ file: 'foo' }] }]));
      });

      describe('slug', () => {
        it('should set default slug config if not set', () => {
          expect(applyDefaults(fromJS({ collections: [] })).get('slug')).toEqual(
            fromJS({ encoding: 'unicode', clean_accents: false, sanitize_replacement: '-' }),
          );
        });

        it('should not overwrite slug encoding if set', () => {
          expect(
            applyDefaults(fromJS({ collections: [], slug: { encoding: 'ascii' } })).getIn([
              'slug',
              'encoding',
            ]),
          ).toEqual('ascii');
        });

        it('should not overwrite slug clean_accents if set', () => {
          expect(
            applyDefaults(fromJS({ collections: [], slug: { clean_accents: true } })).getIn([
              'slug',
              'clean_accents',
            ]),
          ).toEqual(true);
        });

        it('should not overwrite slug sanitize_replacement if set', () => {
          expect(
            applyDefaults(fromJS({ collections: [], slug: { sanitize_replacement: '_' } })).getIn([
              'slug',
              'sanitize_replacement',
            ]),
          ).toEqual('_');
        });
      });

      describe('public_folder and media_folder', () => {
        it('should set collection public_folder collection based on media_folder if not set', () => {
          expect(
            applyDefaults(
              fromJS({
                collections: [{ folder: 'foo', media_folder: 'static/images/docs' }],
              }),
            ).get('collections'),
          ).toEqual(
            fromJS([
              {
                folder: 'foo',
                media_folder: 'static/images/docs',
                public_folder: 'static/images/docs',
              },
            ]),
          );
        });

        it('should not overwrite collection public_folder if set', () => {
          expect(
            applyDefaults(
              fromJS({
                collections: [
                  {
                    folder: 'foo',
                    media_folder: 'static/images/docs',
                    public_folder: 'images/docs',
                  },
                ],
              }),
            ).get('collections'),
          ).toEqual(
            fromJS([
              {
                folder: 'foo',
                media_folder: 'static/images/docs',
                public_folder: 'images/docs',
              },
            ]),
          );
        });

        it("should set collection media_folder and public_folder to an empty string when collection path exists, but collection media_folder doesn't", () => {
          expect(
            applyDefaults(
              fromJS({
                collections: [{ folder: 'foo', path: '{{slug}}/index' }],
              }),
            ).get('collections'),
          ).toEqual(
            fromJS([
              { folder: 'foo', path: '{{slug}}/index', media_folder: '', public_folder: '' },
            ]),
          );
        });
      });
    });
  });

  describe('detectProxyServer', () => {
    const assetFetchCalled = (url = 'http://localhost:8081/api/v1') => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'info' }),
      });
    };

    beforeEach(() => {
      delete window.location;
    });

    it('should return undefined when not on localhost', async () => {
      window.location = { hostname: 'www.netlify.com' };
      global.fetch = jest.fn();
      await expect(detectProxyServer()).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledTimes(0);
    });

    it('should return undefined when fetch returns an error', async () => {
      window.location = { hostname: 'localhost' };
      global.fetch = jest.fn().mockRejectedValue(new Error());
      await expect(detectProxyServer(true)).resolves.toBeUndefined();

      assetFetchCalled();
    });

    it('should return undefined when fetch returns an invalid response', async () => {
      window.location = { hostname: 'localhost' };
      global.fetch = jest
        .fn()
        .mockResolvedValue({ json: jest.fn().mockResolvedValue({ repo: [] }) });
      await expect(detectProxyServer(true)).resolves.toBeUndefined();

      assetFetchCalled();
    });

    it('should return proxyUrl when fetch returns a valid response', async () => {
      window.location = { hostname: 'localhost' };
      global.fetch = jest
        .fn()
        .mockResolvedValue({ json: jest.fn().mockResolvedValue({ repo: 'test-repo' }) });
      await expect(detectProxyServer(true)).resolves.toBe('http://localhost:8081/api/v1');

      assetFetchCalled();
    });

    it('should use local_backend url', async () => {
      const url = 'http://localhost:8082/api/v1';
      window.location = { hostname: 'localhost' };
      global.fetch = jest
        .fn()
        .mockResolvedValue({ json: jest.fn().mockResolvedValue({ repo: 'test-repo' }) });
      await expect(detectProxyServer({ url })).resolves.toBe(url);

      assetFetchCalled(url);
    });
  });
});
