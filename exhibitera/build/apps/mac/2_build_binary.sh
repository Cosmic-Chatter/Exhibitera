if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
cd "$1" || exit 1
pyinstaller --clean --onefile \
            --add-data "*.html:."\
            --add-data "*.md:."\
            --add-data "*.txt:."\
            --add-data "js/app.js:js/." \
            --add-data "js/coloris.min.js:js/." \
            --add-data "js/exhibitera_app_common.js:js/." \
            --add-data "js/exhibitera_file_select_modal.js:js/." \
            --add-data "js/exhibitera_setup_common.js:js/." \
            --add-data "js/first_time_setup.js:js/." \
            --add-data "js/html2canvas.min.js:js/." \
            --add-data "js/jquery-3.6.1.min.js:js/." \
            --add-data "js/jquery.profanityfilter.min.js:js/." \
            --add-data "js/platform.js:js/." \
            --add-data "js/pluralize-8.0.0.js:js/." \
            --add-data "js/popper.min.js:js/." \
            --add-data "js/setup.js:js/." \
            --add-data "js/showdown.min.js:js/." \
            --add-data "js/simple-keyboard.js:js/." \
            --add-data "js/swearWords.js:js/." \
            --add-data "js/wordcloud2.js:js/." \
            --add-data "js/bootstrap_5_3/*:js/bootstrap_5_3/." \
            --add-data "css/bootstrap_5_3/*:css/bootstrap_5_3/." \
            --add-data "css/coloris.min.css:css/." \
            --add-data "css/exhibitera-common.css:css/." \
            --add-data "css/setup.css:css/." \
            --add-data "css/simple-keyboard.css:css/." \
            --add-data "_fonts/*:_fonts/." \
            --add-data "dmx_control/*.*:dmx_control/." \
            --add-data "InfoStation/*.*:InfoStation/." \
            --add-data "media_browser/*.*:media_browser/." \
            --add-data "media_player/*.*:media_player/." \
            --add-data "other/*.*:other/." \
            --add-data "_static/*:_static/." \
            --add-data "_static/flags/*:_static/flags/." \
            --add-data "_static/icons/*:_static/icons/." \
            --add-data "timelapse_viewer/*:timelapse_viewer/." \
            --add-data "timeline_explorer/*:timeline_explorer/." \
            --add-data "voting_kiosk/*:voting_kiosk/." \
            --add-data "word_cloud/*:word_cloud/." \
            Exhibitera_Apps.py