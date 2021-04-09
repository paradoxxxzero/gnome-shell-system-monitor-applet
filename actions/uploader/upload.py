import os
import sys

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options


class MyDriver(webdriver.Chrome):
    def __init__(self, *args, **kwargs):
        options = Options()
        options.add_argument('headless')
        options.add_argument("no-sandbox")
        options.add_argument("disable-dev-shm-usage")
        options.add_experimental_option('detach', True)
        super().__init__(options=options)

    def find_by_css(self, selector):
        return WebDriverWait(self, 10) \
            .until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))


def main(username, password, zipball_path):
    login_url = 'https://extensions.gnome.org/accounts/login/?next=/upload/'

    driver = MyDriver()

    # login
    driver.get(login_url)
    ipt_username = driver.find_by_css('form.auth_form input#id_username')
    ipt_password = driver.find_by_css('form.auth_form input#id_password')
    btn_submit = driver.find_by_css('form.auth_form button[type=submit]')
    ipt_username.send_keys(username)
    ipt_password.send_keys(password)
    print("Submitting login form")
    btn_submit.click()

    # submit new build
    ipt_source = driver.find_by_css('input#id_source')
    ipt_source.send_keys(zipball_path)
    driver.find_by_css('#id_gplv2_compliant').click()
    driver.find_by_css('#id_tos_compliant').click()
    print("Submitting extension form")
    driver.find_by_css('#container button[type=submit]').click()
    print("Done!")


if __name__ == "__main__":
    username = os.getenv('USERNAME')
    password = os.getenv('PASSWORD')
    zipball_path = os.getenv('ZIPBALL')

    if not all([username, password, zipball_path]):
        print(("Please set the following environment variables: "
               "USERNAME, PASSWORD, ZIPBALL"))
        sys.exit(1)

    zipball_path = os.path.abspath(zipball_path)
    print(f"Submitting {zipball_path} as {username}")
    main(username, password, zipball_path)
