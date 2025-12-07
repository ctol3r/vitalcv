from flask import Flask, request

app = Flask(__name__)

@app.route('/', methods=['GET'])
def index():
    return '''<h1>Bug Bounty Report</h1>
<form action="/submit" method="post">
Name: <input name="name"><br>
Email: <input name="email"><br>
Description:<br><textarea name="description"></textarea><br>
<input type="submit" value="Submit Bug">
</form>'''

@app.route('/submit', methods=['POST'])
def submit():
    name = request.form.get('name', '')
    email = request.form.get('email', '')
    description = request.form.get('description', '')
    with open('bug_reports.txt', 'a') as f:
        f.write(f"Name: {name}\nEmail: {email}\nDescription: {description}\n---\n")
    return 'Bug submitted. Thank you!'

if __name__ == '__main__':
    app.run(debug=True)
