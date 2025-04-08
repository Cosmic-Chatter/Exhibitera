if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
cd "$1" || exit 1

pyinstaller --clean --onefile \
			--add-data "exhibitera/hub/_static/:exhibitera/hub/_static/."\
			--add-data "exhibitera/hub/css/:exhibitera/hub/css/."\
			--add-data "exhibitera/hub/features/*.py:exhibitera/hub/features/."\
			--add-data "exhibitera/hub/js/:exhibitera/hub/js/."\
			--add-data "exhibitera/hub/__init__.py:exhibitera/hub/."\
			--add-data "exhibitera/hub/config.js:exhibitera/hub/."\
			--add-data "exhibitera/hub/config.py:exhibitera/hub/."\
			--add-data "exhibitera/hub/Hub.py:exhibitera/hub/."\
			--add-data "exhibitera/hub/index.html:exhibitera/hub/."\
			--add-data "exhibitera/hub/manifest.json:exhibitera/hub/."\
			--add-data "exhibitera/hub/manifest.json:exhibitera/hub/."\
			--add-data "exhibitera/hub/README.md:exhibitera/hub/."\
			--add-data "exhibitera/hub/tools.py:exhibitera/hub/."\
			--add-data "exhibitera/hub/tracker.html:exhibitera/hub/."\
			--runtime-tmpdir ./AppData/ \
		Exhibitera_Hub.py
