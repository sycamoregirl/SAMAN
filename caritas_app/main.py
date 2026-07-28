import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'vendor'))
try:
    import app
    app.app.run(debug=False, host='0.0.0.0', port=5000)
except Exception as e:
    f = open(os.path.join(os.path.dirname(__file__), 'error.log'), 'w')
    f.write(str(e) + '\n')
    import traceback
    traceback.print_exc(file=f)
    f.close()
    input("Error: " + str(e) + "\nPresiona Enter para salir...")
