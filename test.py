import paramiko
import time
import pyAesCrypt
from os import stat, remove
import mysql.connector
from mysql.connector import Error
import requests
import csv
import datetime
from netmiko.dlink.dlink_ds import DlinkDSSSH
from panos import firewall
import os
import shutil
import stat
import logging
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import paramiko
import pexpect
import time

def connect(server_ip, username, passwd, port, firewallType):
    """
    This method is used to establish SSH connection with FW by using below parameters
    :param server_ip: FW IP
    :param username: FW Username
    :param passwd: FW Password
    :param port: FW SSH Port
    :return: SSH_CLIENT Session
    """
    try:
        print("\nConnecting to "+server_ip)
        ssh_client = paramiko.SSHClient()
        ssh_client.load_system_host_keys()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh_client.connect(hostname=server_ip, username=username, password=passwd, port=port, look_for_keys=False,
                           allow_agent=False,
                           timeout=30, banner_timeout=15, auth_timeout=30)
        print("\nConnection Successful to "+server_ip)
        return ssh_client, "paramiko"
    except Exception as e:
        if firewallType == 'PALOALTO' or firewallType == 'Paloalto':
            pass
        else:
            print("EXCEPTION IN CONNECT METHOD>>>", e)

def connect_dlink_3100(server_ip, ssh_user, password, port, deviceModel):
    """
    Specialized SSH connection for D-Link 3100 switches using pexpect.
    Returns: (session, 'pexpect') or (None, None) on failure
    """
    try:
        # Build SSH command
        ssh_cmd = f"ssh {ssh_user}@{server_ip}"
        session = pexpect.spawn(ssh_cmd, timeout=30)
        session.logfile = open("ssh_debug_3100.log", "wb")

        # Expect login prompts
        session.expect("UserName:")
        session.sendline(ssh_user)
        session.expect("Password:")
        session.sendline(password)

        # Wait for CLI prompt
        session.expect("#", timeout=15)

        print(f"[+] Logged into D-Link 3100 switch {server_ip} ({deviceModel})")
        return session, 'pexpect'

    except pexpect.exceptions.TIMEOUT:
        print(f"[-] Timeout: Could not login to {server_ip}")
    except pexpect.exceptions.EOF:
        print(f"[-] Connection closed unexpectedly by {server_ip}")
    except Exception as e:
        print(f"[-] Unexpected error: {e}")

    return None, None

def get_shell(ssh_client):
    """
    This method is used to get the invoke shell session which is used to execute commands
    :param ssh_client: ssh_client session
    :return: invoke_shell session
    """
    shell = ssh_client.invoke_shell()
    # shell.keep_this = ssh_client
    return shell


def send_command(shell, command, timeout=5):
    """
    This Function is to execute the commands
    :param shell: shell session
    :param command: command to execute
    :param timeout: timeout to sleep to delay while running command
    :return: it return nothing, it just execute the command given
    """
    #print("\nSending command '"+command+"'")
    shell.send(command + '\n')
    time.sleep(timeout)


def show_output(shell, n=10000000000000000000000000000000000000000000000000000000):
    """
    This Function is to return the decoded shell session's output in mentioned bytes
    :param shell: shell session
    :param n: no of bytes of output required
    :return: decoded command output
    """
    output = shell.recv(n)
    return output.decode('ascii', 'ignore')


def close_connection(ssh_client):
    """
    This method is to close the SSH connection
    :param ssh_client: SSH_CLIENT SESSION
    :return: NA
    """
    if ssh_client.get_transport().is_active():
        print("connection closed")
        ssh_client.close()


# encrypt file
def encrypt_file(filename, password, bufferSize, enc_backup_file):
    """
    This method is used to encrypt the file and create a encrypted file in mentioned directory
    :param filename: Filename to encrypt
    :param password: encryption password
    :param bufferSize: encryption bufferSize
    :return: create a encrypted file in mentioned directory
    """
    try:
        with open(filename, "rb") as fIn:
            encrypt_filename =  enc_backup_file
            with open(encrypt_filename, "wb") as fOut:
                pyAesCrypt.encryptStream(fIn, fOut, password, bufferSize)
                fOut.close()
                fIn.close()
                return encrypt_filename
    except Exception as e:
        print("EXCEPTION while encrypting>>>", e)

def main():
    successCount = 0
    failureCount = 0
    successList = []
    FailureList = []
    try:
    # Get the process type from the environment variable
        process_type = os.getenv('PROCESS_TYPE', 'odd')  # Default to 'odd'
        process_condition = "MOD(id, 2) = 1" if process_type == 'odd' else "MOD(id, 2) = 0"
        print("Before Try")
        connection = mysql.connector.connect(
            host='localhost',
            database='networkbkp',
            user='root',
            password='P@55w0rd@123$#$'
        )

        if connection.is_connected():
            cursor = connection.cursor()

        # Correctly format the SQL query with the process_condition
        #sql_select_Query = f"""SELECT ip_address, username, AES_DECRYPT(password, UNHEX('F3229A0B371ED2D9441B830D21A390C3')) AS decrypted_password, port, client_nw, make, id, device_type, model FROM ctrlsnetworksinventory WHERE status=1 AND ip_address = '198.18.10.66' ;"""
        sql_select_Query = f"""SELECT ip_address, username, AES_DECRYPT(password, UNHEX('F3229A0B371ED2D9441B830D21A390C3')) AS decrypted_password, port, client_nw, make, id, device_type, model FROM ctrlsnetworksinventory WHERE status=1 AND {process_condition} AND client_nw NOT IN ('AEDX3FW04','GCAQKFW01','GCAQKFW02','GCAQKCORE01','GCAQKCORE02','GCRUHFW01','GCRUHFW02','GCRUHCORE01','GCRUHCORE02','AEDX3FW01','AEDX3CORE01','AEDX3CORE02','AEDX3COREFW02','AEDX3COREFW01','AEDX3FW03','TP-Riyadh-GCRUHFW01-200F','GCDXBCORE01','GCDXBCORE02','GCDXBFW05','GCDXBFW06','GCDXBFW03-Sec','GCDXBFW03-Pri','GCDXBFW01','TELE-ADDA-CORE-SW-1','TELE-ADDA-CORE-SW-02','SGSL-ADSIC-FW01','SGS_ADSIC_CORE_2','SGS_ADSIC_CORE_1','GCDXBFW11-sec','GCDXBFW11-pri','GCDXBFW09-FGT200F','GCDXBCORE04','GCDXBCORE03','GCDXBACCESS22','GCDXBACCESS21','GCDXBACCESS20','GCRUHACSWEDGE02','GCRUHACSWEDGE01','GCRUHACFWEDGE01','GCRUHACFW01','GCRUHACCORE02','GCRUHACCORE01','p-riynor-fgt400e-telperf-01','UAE-DUB2-Teleperformance-FGT-FW','GCDXBFW07-FGT100E');"""
        cursor.execute(sql_select_Query)
        records = cursor.fetchall()

        print("\nTotal Network Inventory in Database is: ", cursor.rowcount)
        print("\nExecuting Backup Commands on all Inventory !!\n")
        print("*******************************************************************************************************************")

        for row in records:
            print(row)
            try:
                if type(row[2]) == str:
                    password = row[2].strip()
                else:
                    password = row[2].decode()
                print(row[0].strip(), row[1].strip(), password.strip(), row[3], row[4].strip(), row[5].strip(), row[7].strip(), row[8].strip())
                result = backup(row[0].strip(), row[1].strip(), password.strip(), row[3], row[4].strip(), row[5].strip(), row[7].strip(), row[8].strip())
                successCount = successCount + 1
                list1 = [row[0], row[4], row[5], str(result)]
                tuple1 = tuple(list1)
                successList.append(tuple1)
            except Exception as e:
                print(e)
                list2 = [row[0], row[4], row[5], "SSH Failed"]
                tuple2 = tuple(list2)
                FailureList.append(tuple2)
                failureCount = failureCount + 1
                pass
    except Error as e:
        print("Error reading data from MySQL table", e)
    finally:
        if connection.is_connected():
            connection.close()
            cursor.close()
            print("MySQL connection is closed")
        else:
            pass
        print(FailureList)
        print(successList)
        with open('backup_success.csv', 'w') as out:
            csv_out = csv.writer(out)
            csv_out.writerow(['ip', 'clientName', 'FirewallType', 'Status'])
            for row in successList:
                csv_out.writerow(row)
        with open('backup_failed.csv', 'w') as out:
            csv_out = csv.writer(out)
            csv_out.writerow(['ip', 'clientName', 'FirewallType', 'FailedReason'])
            for row in FailureList:
                csv_out.writerow(row)
        success_result_file = open("backup_success.csv", "rb")
        failure_result_file = open("backup_failed.csv", "rb")
        status_file = {"successfile": success_result_file, "failedfile": failure_result_file}

        resultdata = {'successcount': successCount, 'failedcount': failureCount}
        url = "https://103.241.138.20/aiops/backupresult.php"
        r = requests.post(url=url, files=status_file, data=resultdata, verify=False)
        if r.status_code == 200:
            print(r.content)
            #print("\nFile Uploaded successfully")
        else:
            print("\nFailed to upload file")

def backup(ip, username, password, port, client, firewallType, deviceType, deviceModel):
    if firewallType.lower() == 'dlink' and '3100' in deviceModel:
        ssh_client, conn_type = connect_dlink_3100(ip, username, password, port, deviceModel)
    else:
        ssh_client, conn_type = connect(ip, username, password, port, firewallType)

    print("\nTaking Configuration Backup for " + ip)
    try:
        if conn_type == 'paramiko':
            shell = get_shell(ssh_client)
        else:
            shell = ssh_client  # pexpect session
    except:
        pass
    #if deviceType.lower() == 'firewall' and firewallType.lower() == 'fortigate':
        #command = 'a\nconfig system console\nset output standard\nend\nshow full-configuration\nexit'
        #stdin, stdout, stderr = ssh_client.exec_command(command)
    if deviceType.lower() == 'firewall' and firewallType.lower() == 'fortianalyzer':
        command = 'show'
        stdin, stdout, stderr = ssh_client.exec_command(command)
        stdout1 = stdout.read().decode()

    elif deviceType.lower() == 'firewall' and firewallType.lower() == 'fortigate':    

        def read_large_output(stdout, timeout=120):
            output = b''
            end_time = time.time() + timeout
            while time.time() < end_time:
                if stdout.channel.recv_ready():
                    output += stdout.channel.recv(4096)
                else:
                    time.sleep(1)
            return output

        raw_output = read_large_output(stdout)

        try:
            stdout1 = raw_output.decode('utf-8')
        except UnicodeDecodeError:
            stdout1 = raw_output.decode('utf-8', errors='ignore')

#    if deviceType.lower() == 'firewall' and firewallType == 'FORTIGATE' or firewallType == 'fortigate':
#        command = 'a\nconfig system console\nset output standard\nend\nshow full-configuration\nexit'
        #command = 'a\nshow full-configuration\nexit'
#        stdin, stdout, stderr = ssh_client.exec_command(command)
#        stdout1 = stdout.read().decode()
    elif deviceType == 'Firewall' and firewallType == 'CISCO' or firewallType == 'cisco':
        command = 'enable'
        send_command(shell, command)
        enable_output = show_output(shell)
        if "Password:" in enable_output:
            command = password
            send_command(shell, command)
        else:
            pass
        command = 'terminal pager 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show run'
        send_command(shell, command, 20)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
    elif deviceType == 'Switch' and firewallType == 'CISCO' or firewallType == 'cisco':
        command = 'terminal length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show run'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
       #stdin, stdout, stderr = ssh_client.exec_command(command)
       #stdout1 = stdout.read().decode()
    elif deviceType == 'Switch' and firewallType == 'ARISTA' or firewallType == 'Arista':
        command = 'terminal length 0'
        send_command(shell, command)
        no_output = show_output(shell)

        command = 'show running-config'
        send_command(shell, command, 20)   # timeout 20s
        stdout1 = show_output(shell)

        command = 'exit'
        send_command(shell, command, 3)
    elif deviceType == 'Switch' and firewallType == 'NOKIA' or firewallType == 'Nokia':
        command = 'environment no more'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'admin display-config'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'logout'
        send_command(shell, command, 3)
    elif deviceType == 'Router' and firewallType == 'CISCO' or firewallType == 'cisco':
        command = 'terminal length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show run'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
       # stdin, stdout, stderr = ssh_client.exec_command(command)
       # stdout1 = stdout.read().decode()
    elif deviceType == 'LB' and firewallType == 'A10' or firewallType == 'a10':
        command = 'terminal length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show running-config partition-config all'
        # send_command(shell, command)
        # stdout1 = show_output(shell)
        stdin, stdout, stderr = ssh_client.exec_command(command)
        stdout1 = stdout.read().decode()
        command = 'exit'
        send_command(shell, command, 3)
        command = 'exit'
        send_command(shell, command, 3)
    elif deviceType == 'LB' and firewallType == 'Citrix':
        #command = 'show ns runningconfig'
        command = 'show ns ns.conf'
        send_command(shell, command)
        stdin, stdout, stderr = ssh_client.exec_command(command)
        stdout1 = stdout.read().decode()
        command = 'exit'
        send_command(shell, command, 3)

    elif deviceType == 'Switch' and firewallType == 'HP' or firewallType == 'hp':
        command = 'system-view'
        send_command(shell, command)
        command = 'line vty 0'
        send_command(shell, command)
        command = 'screen-length 0'
        send_command(shell, command)
        command = 'quit'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'display current-configuration'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'quit'
        send_command(shell, command)
        command = 'quit'
        send_command(shell, command)
    #elif deviceType == 'Switch' and firewallType == 'CISCO_NEXUS' or firewallType == 'Cisco_Nexus':
    elif deviceType == 'Switch' and (firewallType == 'CISCO_NEXUS' or firewallType == 'Cisco_Nexus' or firewallType == 'CISCO-NEXUS'):  
        #print("NEXUS SWITCH")
        command = 'terminal length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show running-config'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
    elif deviceType == 'Router' and firewallType == 'JUNIPER' or firewallType == 'Juniper':
        #print("NEXUS SWITCH")
        command = 'set cli screen-length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show configuration | display set'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
    elif deviceType == 'Switch' and firewallType == 'JUNIPER' or firewallType == 'Juniper':
        #print("NEXUS SWITCH")
        command = 'set cli screen-length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show configuration | display set'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
    elif deviceType == 'Switch' and firewallType == 'DELL' or firewallType == 'Dell':
        command = 'enable'
        send_command(shell, command)
        time.sleep(15)
        enable_output = show_output(shell)
        if "Password:" in enable_output:
            command = password
            send_command(shell, command)
            time.sleep(15)
        else:
            pass
        command = 'terminal length 0'
        send_command(shell, command)
        time.sleep(10)
        no_ouput = show_output(shell)
        command = 'show running-configuration'
        send_command(shell, command)
        time.sleep(70)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
        time.sleep(10)
    elif deviceType == 'Switch' and firewallType == 'HUAWEI' or firewallType == 'Huawei':
        command = 'screen-length 0 temporary'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'display current-configuration all'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'quit'
        send_command(shell, command)
        #stdin, stdout, stderr = ssh_client.exec_command(command)
        #stdout1 = stdout.read().decode()
    elif deviceType == 'LB' and firewallType == 'vThunder' or firewallType == 'vTHUNDER':
        command = 'enable'
        send_command(shell, command)
        enable_output = show_output(shell)
        if "Password:" in enable_output:
            command = '\n'
            send_command(shell, command)
        else:
            command = 'enable'
            send_command(shell, command, 10)
            enable_output = show_output(shell)
            if "Password:" in enable_output:
                command = password
                send_command(shell, command)
            else:
                pass
        command = 'terminal length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show run partition-config all'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command, 3)
        command = 'exit'
        send_command(shell, command, 3)
        command = 'Y'
        send_command(shell, command,3)
    elif deviceType == 'Switch' and firewallType == 'DLINK' or firewallType == 'Dlink':
        if '3120' in deviceModel:
            command = 'show config effective'
            send_command(shell, command)
            no_ouput = show_output(shell)
            command = 'a'
            send_command(shell, command, 10)
            stdout1 = show_output(shell)
            command = 'logout'
            send_command(shell, command)
        elif '3100' in deviceModel:
            ssh_client.sendline('show config running')
            ssh_client.expect('Next Entry', timeout=30)  # pager prompt
            config_output = ssh_client.before.decode('ascii', 'ignore')
            ssh_client.sendline('a')  # show all pages
            ssh_client.expect('#', timeout=30)
            config_output += ssh_client.before.decode('ascii', 'ignore')
            ssh_client.sendline('logout')
            print("[+] Logged out successfully")
            stdout1 = config_output
        elif '1510' in deviceModel:
            command = 'show running-config'
            send_command(shell, command)
            no_ouput = show_output(shell)
            command = 'a'
            send_command(shell, command, 10)
            stdout1 = show_output(shell)
            command = 'logout'
            send_command(shell, command)
    elif deviceType == 'Firewall' and firewallType == 'PALOALTO' or firewallType == 'Paloalto':
        fw = firewall.Firewall(ip, username, password)
        a = fw.op("show config running", xml=True)
        fw.op(cmd="delete admin-sessions")
        stdout1 = str(a)
    elif deviceType.lower() == 'firewall' and firewallType.lower() == 'dell_sonicwall':
        command = 'configure'
        send_command(shell, command)
        command = 'yes'
        send_command(shell, command)
        command = 'no cli pager session'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show current-config'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command)
        command = 'exit'
        send_command(shell, command)
    elif deviceType == 'Switch' and firewallType == 'LENOVO' or firewallType == 'Lenovo':
        command = 'terminal length 0'
        send_command(shell, command)
        no_ouput = show_output(shell)
        command = 'show run'
        send_command(shell, command, 10)
        stdout1 = show_output(shell)
        command = 'exit'
        send_command(shell, command)
    elif deviceType == 'Firewall' and firewallType == 'CHECKPOINT' or firewallType == 'Checkpoint':
        if '750' in deviceModel or '770' in deviceModel or '790' in deviceModel:
            command = 'show configuration'
            stdin, stdout, stderr = ssh_client.exec_command(command)
            stdout1 = stdout.read().decode()
            command = 'exit'
            stdin, stdout, stderr = ssh_client.exec_command(command)
        elif '6200' in deviceModel or 'MGMT-SERVER' in deviceModel:
            command = 'set clienv rows 0'
            send_command(shell, command)
            no_ouput = show_output(shell)
            command = 'show configuration'
            send_command(shell, command, 10)
            stdout1 = show_output(shell)
            command = 'exit'
            send_command(shell, command)
        else:
            pass
    else:
        pass

    show_run_output = stdout1
    if firewallType == "Paloalto" or firewallType == "PALOALTO":
        show_run_output = show_run_output
        timestr = time.strftime("%d-%m-%Y-%H-%M-%S")
        backup_file = "config-backup_" + ip + "_" + client + "_" + timestr + ".txt"
        enc_backup_file = "config-backup_" + ip + "_" + client + "_" + timestr + ".aes"
        show_run_output = str(show_run_output).split("\\n")
        # print(show_run_output, len(show_run_output))
        with open(backup_file, 'w') as f:
            for i in show_run_output:
                f.write(i)
                f.write("\n")
        print("Backup Successfull for " + ip)

    else:
        show_run_output = show_run_output
        timestr = time.strftime("%d-%m-%Y-%H-%M-%S")
        backup_file = "config-backup_" + ip + "_" + client + "_" + timestr + ".txt"
        enc_backup_file = "config-backup_" + ip + "_" + client + "_" + timestr + ".aes"
        with open(backup_file, 'w') as f1:
            f1.write(show_run_output)
            print("Backup Successfull for " + ip)

    print("\nEncrypting Backup File.....")
    # encrypting latest backup file
    bufferSize = 64 * 1024
    password = "Backup"
    encrypted_file = encrypt_file(backup_file, password, bufferSize, enc_backup_file)
    #sending Encrypted Backup file to server
    time.sleep(4)

    result_file = open(encrypted_file, "rb")
    upload_file = {
        "file": (encrypted_file, result_file, "application/octet-stream")
    }
    #upload_file = {"file": result_file}
    url = "https://103.241.138.20/aiops/upload.php"
    r = requests.post(url, files=upload_file, verify=False)

    if r.status_code == 200:
        remove(backup_file)
        result_file.close()
        remove(encrypted_file)
        print("\nFile Uploaded successfully")
        return r.content
    else:
        remove(backup_file)
        remove(encrypted_file)
        print("\nFailed to upload file")
        return r.content


if __name__ == "__main__":
    main()
    print(datetime.datetime.now())
