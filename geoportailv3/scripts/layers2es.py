# -*- coding: utf-8 -*-

from pyramid.paster import bootstrap
import sys
import getopt
import json
import requests
from elasticsearch import helpers
from elasticsearch.helpers import BulkIndexError
from elasticsearch.exceptions import ConnectionTimeout
from geoportailv3.lib.search import get_elasticsearch, get_index, ensure_index
from pyramid.i18n import TranslationStringFactory, make_localizer
from pyramid.interfaces import ITranslationDirectories


"""
Utility functions for importing layers metadata into Elasticsearch
"""


def update_document(index, type, obj=None):
    doc = {
        "_index": index,
        "_type": type,
        "_id": str(obj['layer_id']) + "_" + obj['language']
    }
    doc['_source'] = {}
    doc['_source']['role_id'] = obj['role_id']
    doc['_source']['public'] = obj['public']
    doc['_source']['language'] = obj['language']
    doc['_source']['layer_id'] = obj['layer_id']
    doc['_source']['name'] = obj['name']
    doc['_source']['name_translated'] = obj['name_translated']
    doc['_source']['description'] = obj['description']
    doc['_source']['keywords'] = obj['keywords']
    doc['_source']['metadata_name'] = obj['metadata_name']
    return doc


def statuslog(text):
    sys.stdout.write(text)
    sys.stdout.flush()


def main():
    try:
        opts, args = getopt.getopt(sys.argv[1:], 'ri', ['reset', 'index'])
    except getopt.GetoptError as err:
        print str(err)
        sys.exit(2)
    index, reset = False, False
    for o, a in opts:
        if o in ('-r', '--reset'):
            statuslog('\rResetting Index')
            reset = True
        if o in ('-i', '--index'):
            statuslog('\rChecking Index')
            index = True

    env = bootstrap('development.ini')
    from c2cgeoportal.models import DBSession, TreeItem
    request = env['request']
    registry = env['registry']
    ensure_index(get_elasticsearch(request), get_index(request), reset)

    if index:
        layers = DBSession.query(TreeItem) \
                          .filter((TreeItem.item_type == 'l_wmts') |
                                  (TreeItem.item_type == 'lu_int_wms') |
                                  (TreeItem.item_type == 'lu_ext_wms')) \
                          .all()
        metadata_service_url = \
            'http://shop.geoportail.lu/Portail/inspire/webservices/getMD.jsp'
        doc_list = []
        tdirs = registry.queryUtility(ITranslationDirectories, default=[])
        tsf = TranslationStringFactory('geoportailv3-client')
        for layer in layers:
            for lang in request.registry.settings['available_locale_names']:
                localizer = make_localizer(lang, tdirs)
                translated_name = localizer.translate(tsf(layer.name))
                try:
                    public = layer.public
                except:
                    public = True

                layer_data = dict(
                    name_translated=translated_name,
                    name=layer.name,
                    layer_id=layer.id,
                    description='',
                    keywords='',
                    metadata_name='',
                    language=lang,
                    public=public,
                    role_id=1
                )
                for metadata in layer.ui_metadata:
                    if metadata.name == 'metadata_id':
                        params = dict(
                            uid=metadata.value,
                            lang=lang
                        )
                        resp = requests.get(url=metadata_service_url,
                                            params=params)
                        data = json.loads(resp.text)
                        layer_data['keywords'] = data['root'][0]['keywords']
                        layer_data['description'] = \
                            data['root'][0]['description']
                        layer_data['metadata_name'] = data['root'][0]['name']
                doc = update_document(get_index(request),
                                      'layer',
                                      layer_data)
                doc_list.append(doc)
        try:
            helpers.bulk(client=get_elasticsearch(request),
                         actions=doc_list,
                         chunk_size=500,
                         raise_on_error=True)
        except (BulkIndexError, ConnectionTimeout) as e:
            print "\n %s" % e

if __name__ == '__main__':
    main()
