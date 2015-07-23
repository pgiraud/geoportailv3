ifdef VARS_FILE
VARS_FILES += ${VARS_FILE} vars_geoportailv3.yaml
else
VARS_FILE = vars_geoportailv3.yaml
VARS_FILES += ${VARS_FILE}
endif

TEMPLATE_EXCLUDE += LUX_alembic/script.py.mako

LANGUAGES = en fr de lb
CGXP = FALSE
MOBILE = FALSE
NGEO = TRUE
TILECLOUD_CHAIN = FALSE

DISABLE_BUILD_RULES += test-packages test-packages-ngeo

CONFIG_VARS += ldap
CONFIG_VARS += sqlalchemy_engines
CONFIG_VARS += proxy_wms_url
APACHE_VHOST ?= luxembourg-geomapfish

NGEO_LIBS_JS_FILES += node_modules/fuse.js/src/fuse.min.js

UTILITY_HELP = 	"- update-translations	Synchronize the translations with Transifex" \
		"- update-search	Update the ElasticSearch Database"

# Add rule that copies the font-awesome fonts to the static/build directory.
POST_RULES = .build/fonts.timestamp

include CONST_Makefile

REQUIREMENTS += "suds>=0.4"
DEV_REQUIREMENTS += git+https://github.com/transifex/transifex-client.git@fix-proxies#egg=transifex-client-proxies
PRINT_VERSION = NONE 

.PHONY: update-translations
update-translations: $(PACKAGE)/locale/$(PACKAGE)-server.pot $(PACKAGE)/locale/$(PACKAGE)-client.pot
	.build/venv/bin/tx push -s
	.build/venv/bin/tx pull -f

.build/fonts.timestamp: .build/node_modules.timestamp
	mkdir -p $(PACKAGE)/static/build/fonts
	cp node_modules/font-awesome/fonts/* $(PACKAGE)/static/build/fonts/
	touch $@

.PHONY: update-search
update-search:
	.build/venv/bin/db2es

.PHONY: recreate-search
recreate-search:
	.build/venv/bin/db2es --recreate
