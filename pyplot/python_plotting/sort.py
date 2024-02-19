
def pick_sort(item):
    key = 0
    split, pick_str = item["pick"].rsplit("-", 1)
    pick_num = int(pick_str)
    
    if split.isdigit():
        key += (int(split) * 100) + pick_num
    else:
        key += (ord(split[0]) * 100) + pick_num
         
    return key
    
def round_sort(item):
    try:
        return (0, int(item["round"]))
    except ValueError:
        return (1, item["round"])
    
