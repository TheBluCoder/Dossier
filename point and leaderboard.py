 
import random
 

import json
 

import datetime
 

import os
 
# prevent crashing caused by unexpected errors by mongodb
try:
    from pymongo import MongoClient
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False


def connect_to_database(connection_string="mongodb://localhost:27017/",
                         database_name="detective_game"):    

   client = MongoClient(connection_string)

   db = client[database_name]

   return db

DIFFICULTY_SETTINGS = {
    "easy": {
        "min_points": 100,        # lowest possible reward for a correct guess
        "max_points": 200,        # highest possible reward for a correct guess
        "has_wrong_guess_penalty": False,  # easy mode: wrong guesses cost nothing
    },
    "medium": {
        "min_points": 200,
        "max_points": 300,
        "has_wrong_guess_penalty": False,  # medium mode: also no penalty
    },
    "hard": {
        "min_points": 300,
        "max_points": 400,
        "has_wrong_guess_penalty": True,   # hard mode: wrong guesses DO cost points
        "penalty_min": 100,                # smallest point loss for a wrong guess
        "penalty_max": 150,                # largest point loss for a wrong guess
    },
}

def calculate_reward_points(difficulty):
    
    # Returns a random number of points for a CORRECT accusation, based on
    #difficulty
    
    # Look up the min/max points for this difficulty from our settings above.
    settings = DIFFICULTY_SETTINGS[difficulty]
 
    # random.randint picks one random whole number in that range
    reward = random.randint(settings["min_points"], settings["max_points"])
 
    return reward
 
 
def calculate_solved_case_value(unsolved_points):
    
    # Once a case moves to the "Solved" section, its displayed point value
    #becomes 10 TIMES LESS than it was in the "Unsolved" section
    
    
    return unsolved_points // 10

def calculate_hard_mode_penalty(case_status="unsolved"):
    
    #HARD MODE ONLY. Every time the player accuses the WRONG suspect in hard
    #mode, they lose points instead of nothing happening.
 
    #case_status: "unsolved" -> lose the full random penalty (100-150)
                 #"solved"   -> lose 10 times less (10-15)
    
    # Pick a random penalty between 100 and 150 (inclusive), same idea as
    # calculate_reward_points but for a negative outcome.

    base_penalty = random.randint(
        DIFFICULTY_SETTINGS["hard"]["penalty_min"],
        DIFFICULTY_SETTINGS["hard"]["penalty_max"],
    )
 
    # If the case is already solved, the penalty is 10 times smaller.
    if case_status == "solved":
        return base_penalty // 10
 
    # Otherwise (still unsolved), the player loses the full penalty amount.
    return base_penalty

def create_user_if_not_exists(db, username):
    
    existing_user = db["users"].find_one({"username": username})
 
    
    if existing_user is None:
        new_user = {
            "username": username,
            "total_points": 0,       # every new player starts at 0 points
            "solved_case_ids": [],   # empty list - no cases solved yet
        }
        # insert_one() adds this new document into the "users" collection.
        db["users"].insert_one(new_user)
 
    return
 
 
def get_user(db, username):

 return db["users"].find_one({"username": username})

def update_user_points(db, username, points_change):
    db["users"].update_one(
        {"username": username},           # find this user...
        {"$inc": {"total_points": points_change}},  # ...and adjust their points
    )
    return

def get_total_points(db, username):
     user = get_user(db, username)
 
    # If the user does not exist yet, their total is simply 0.
     if user is None:
        return 0
 
     return user["total_points"]

def create_case(db, case_id, difficulty, correct_suspect):
    new_case = {
        "case_id": case_id,
        "difficulty": difficulty,
        "correct_suspect": correct_suspect,   # the "answer" to the mystery
        "status": "unsolved",                 # unsolved or solved
        "points_value": calculate_reward_points(difficulty),
    }
    db["cases"].insert_one(new_case)
    return new_case
 
 
def get_cases_by_section(db, status):
    return list(db["cases"].find({"status": status}))
 
 
def move_case_to_solved(db, case):
    new_value = calculate_solved_case_value(case["points_value"])
 
    db["cases"].update_one(
        {"case_id": case["case_id"]},
        {"$set": {"status": "solved", "points_value": new_value}},
    )
    return

def submit_accusation(db, username, case, suspect_guess):
    difficulty = case["difficulty"]
    correct = suspect_guess.strip().lower() == case["correct_suspect"].strip().lower()
 
    if correct:
        # The player guessed correctly! Award the case's current point value.
        points_awarded = case["points_value"]
        update_user_points(db, username, points_awarded)
 
        # Move the case out of "Unsolved" and into "Solved" (and shrink its
        # displayed value by 10x, per the rules).
        move_case_to_solved(db, case)
 
        return {
            "correct": True,
            "points_change": points_awarded,
            "message": f"Case solved! You earned {points_awarded} points.",
        }
    
   # ---- The guess was WRONG ----
    settings = DIFFICULTY_SETTINGS[difficulty]
 
    if settings["has_wrong_guess_penalty"]:
        # Only HARD mode reaches here. Deduct random penalty points.
        penalty = calculate_hard_mode_penalty(case["status"])
        update_user_points(db, username, -penalty)  # negative = points lost
 
        return {
            "correct": False,
            "points_change": -penalty,
            "message": f"Wrong suspect! You lost {penalty} points. Try again.",
        }
 
    # Easy and Medium mode: wrong accusation costs nothing, just try again.
    return {
        "correct": False,
        "points_change": 0,
        "message": "Wrong suspect! No points lost. Try again.",
    }
 
 
def play_case_easy_or_medium(db, username, case):
    solved = False
 
    # "while not solved" keeps looping until solved becomes True.
    while not solved:
        guess = input(f"[{case['case_id']}] Who is the culprit? ")
        result = submit_accusation(db, username, case, guess)
        print(result["message"])
 
        # Once the player is correct, this flips to True and the loop stops.
        if result["correct"]:
            solved = True
 
    return
 
 
def play_case_hard(db, username, case):
     #for HARD difficulty.
     #Also loops until the player is correct, BUT every wrong guess costs the
     #player points, so this mode is riskier to keep retrying.
     
     

    solved = False
 
    while not solved:
        guess = input(f"[HARD - {case['case_id']}] Who is the culprit? ")
        result = submit_accusation(db, username, case, guess)
        print(result["message"])
 
        if result["correct"]:
            solved = True
 
    return
    

def display_dashboard(db, username):
    total_points = get_total_points(db, username)
    unsolved_cases = get_cases_by_section(db, "unsolved")
    solved_cases = get_cases_by_section(db, "solved")
 
    print("=" * 50)
    print(f"DASHBOARD FOR: {username}")
    print(f"TOTAL POINTS : {total_points}")
    print("-" * 50)
    print(f"UNSOLVED CASES ({len(unsolved_cases)}):")
 
    # A simple for loop to print each unsolved case and its point value.
    for case in unsolved_cases:
        print(f"  - {case['case_id']} ({case['difficulty']}) worth {case['points_value']} pts")
 
    print(f"SOLVED CASES ({len(solved_cases)}):")
    for case in solved_cases:
        print(f"  - {case['case_id']} ({case['difficulty']}) worth {case['points_value']} pts")
    print("=" * 50)
 
    # Return the same info as a dictionary too, so a web route can turn
    # this straight into a JSON API response for your frontend.
    return {
        "username": username,
        "total_points": total_points,
        "unsolved_cases": unsolved_cases,
        "solved_cases": solved_cases,
    }

# leaderBoard Functions#

def get_all_users_sorted_by_points(db):

    #Fetches every user from the database, then sorts them from the highest
    #total_points to the lowest, using a for loop

    all_users_cursor = db["users"].find({})
 
    all_users = []
    # A for loop copies each user document out of the MongoDB cursor and
    # into a normal Python list we can sort and reuse freely.
    for user_document in all_users_cursor:
        all_users.append(user_document)
 
    # sorted() with a "key" tells Python to sort by the total_points field.
    # reverse=True means highest points first (rank #1 at the top).
    sorted_users = sorted(all_users, key=lambda user: user["total_points"], reverse=True)
 
    return sorted_users


def build_weekly_leaderboard(db):
    all_users = get_all_users_sorted_by_points(db)
    total_user_count = len(all_users)
 
    if total_user_count <= 25:
        # Small player base: put every single player on the leaderboard.
        leaderboard_members = all_users
    else:
        # Large player base: randomly choose 10 players for this week's
        
        # everyone, just a random small group each week).
        leaderboard_members = random.sample(all_users, 10)
 
    # Re-sort just this smaller group by points so ranks make sense.
    leaderboard_members = sorted(
        leaderboard_members, key=lambda user: user["total_points"], reverse=True
    )
 
    # Figure out this week's start/end dates to know when to refresh.
    week_start = datetime.date.today()
    week_end = week_start + datetime.timedelta(days=7)
 
    # Build the rank list
    ranked_members = []
    for position, user in enumerate(leaderboard_members):
        ranked_members.append({
            "rank": position + 1,             # ranks start at 1, not 0
            "username": user["username"],
            "total_points": user["total_points"],
        })
 
    leaderboard_document = {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "members": ranked_members,
    }
 
  
    db["leaderboards"].insert_one(dict(leaderboard_document))
 
    # Export a clean JSON copy for the frontend 

   
 
    return leaderboard_document

def export_leaderboard_to_json(leaderboard_document, filepath="leaderboard.json"):
   
    with open(filepath, "w") as json_file:
        json.dump(leaderboard_document, json_file, indent=2)
    return filepath
 
 
def get_latest_leaderboard(db):
   
    # sort by week_start descending (-1) and limit(1) grabs just the newest one.
    latest = db["leaderboards"].find({}).sort("week_start", -1).limit(1)
 
    # Turn the cursor into a list, then grab the first (and only) item.
    latest_list = list(latest)
 
    if len(latest_list) == 0:
        return None
 
    return latest_list[0]

def apply_end_of_week_penalty(db, leaderboard_document):
   
    members = leaderboard_document["members"]
    total_members = len(members)
 
    # Work out how many players make up the bottom 20%.

    # penalized on very small leaderboards instead of rounding down to zero.
    penalty_count = max(int(total_members * 0.20), 1)
 
    bottom_members = members[-penalty_count:]
 
    # A for loop applies the -300 penalty to each of those players.
    for member in bottom_members:
        current_points = get_total_points(db, member["username"])
 
        # New total can never drop below 0, so we use max(0, ...).
        new_total = max(0, current_points - 300)
 
       
        db["users"].update_one(
            {"username": member["username"]},
            {"$set": {"total_points": new_total}},
        )
        print(f"[PENALTY] {member['username']} dropped to {new_total} points (bottom 20%).")
 
    return bottom_members


def refresh_leaderboard_weekly(db):
   
    latest_leaderboard = get_latest_leaderboard(db)
 
    # If there has never been a leaderboard before, just build the first one.
    if latest_leaderboard is None:
        return build_weekly_leaderboard(db)
 
    # Convert the stored week_end string back into a real date object.
    week_end_date = datetime.date.fromisoformat(latest_leaderboard["week_end"])
    today = datetime.date.today()
 
    if today >= week_end_date:
        # The week is over! Penalize the bottom 20% of last week's group...
        apply_end_of_week_penalty(db, latest_leaderboard)
 
        # start a fresh leaderboard group for the new week.
        return build_weekly_leaderboard(db)
 
    # The current week has not ended yet, so we just return what we have.
    return latest_leaderboard

def display_leaderboard(leaderboard_document):
   
    print("=" * 50)
    print(f"LEADERBOARD  ({leaderboard_document['week_start']} to {leaderboard_document['week_end']})")
    print("-" * 50)
 
    # A for loop prints every player's rank, name, and points.
    for member in leaderboard_document["members"]:
        print(f"  #{member['rank']:>2}  {member['username']:<15} {member['total_points']} pts")
    print("=" * 50)
    return

def main():
   
    db = connect_to_database()

    
    if db is None:
        db = FakeDatabase()

   
    seed_starter_cases(db)

    
    username = input("Enter your detective name: ").strip()
    if username == "":
        username = "detective"
    create_user_if_not_exists(db, username)

    print(f"\nWelcome, Detective {username}!")

   
    playing = True
    while playing:
        print_main_menu()
        choice = input("Choose an option (1-6): ").strip()

        if choice == "1":
            case = get_next_unsolved_case(db, "easy")
            if case is None:
                print("No unsolved EASY cases left. Nice work, Detective!")
            else:
               
                play_case_easy_or_medium(db, username, case)

        elif choice == "2":
            case = get_next_unsolved_case(db, "medium")
            if case is None:
                print("No unsolved MEDIUM cases left. Nice work, Detective!")
            else:
                play_case_easy_or_medium(db, username, case)

        elif choice == "3":
            case = get_next_unsolved_case(db, "hard")
            if case is None:
                print("No unsolved HARD cases left. Nice work, Detective!")
            else:
                
                play_case_hard(db, username, case)

        elif choice == "4":
            
            display_dashboard(db, username)

        elif choice == "5":
            
            leaderboard = refresh_leaderboard_weekly(db)
            display_leaderboard(leaderboard)

        elif choice == "6":
            print(f"Thanks for playing, Detective {username}! Final score: "
                  f"{get_total_points(db, username)} points.")
            playing = False  

        else:
            print("That's not a valid option, please choose 1-6.")

    return



if __name__ == "__main__":
    main()
