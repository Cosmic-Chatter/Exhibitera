if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
cd "$1" || exit 1

pyinstaller --clean --onefile  \
			--add-data "index.html:."\
			--add-data "webpage.js:." \
			--add-data "tracker.html:." \
			--add-data "tracker.js:." \
			--add-data "config.js:." \
			--add-data "version.txt:." \
			--add-data "constellation_dmx.js:." \
			--add-data "constellation_exhibit.js:." \
			--add-data "constellation_issues.js:." \
			--add-data "constellation_maintenance.js:." \
			--add-data "constellation_projector.js:." \
			--add-data "constellation_schedule.js:." \
			--add-data "constellation_tools.js:." \
			--add-data "constellation_tracker.js:." \
			--add-data "README.md:." \
			--add-data "css/*:./css/." \
			--add-data "css/bootstrap_5_3/*:./css/bootstrap_5_3/." \
			--add-data "js/bootstrap_5_3/*:./js/bootstrap_5_3/." \
			--add-data "js/*:./js/." \
			--add-data "icon/*:./icon/." \
			--add-data "images/*:./images/." \
		control_server.py
