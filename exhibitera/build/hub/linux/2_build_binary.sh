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
			--add-data "exhibitera_dmx.js:." \
			--add-data "exhibitera_exhibit.js:." \
			--add-data "exhibitera_issues.js:." \
			--add-data "exhibitera_maintenance.js:." \
			--add-data "exhibitera_projector.js:." \
			--add-data "exhibitera_schedule.js:." \
			--add-data "exhibitera_tools.js:." \
			--add-data "exhibitera_tracker.js:." \
			--add-data "README.md:." \
			--add-data "css/*:./css/." \
			--add-data "css/bootstrap_5_3/*:./css/bootstrap_5_3/." \
			--add-data "js/bootstrap_5_3/*:./js/bootstrap_5_3/." \
			--add-data "js/*:./js/." \
			--add-data "icon/*:./icon/." \
			--add-data "images/*:./images/." \
		Exhibitera_Hub.py
